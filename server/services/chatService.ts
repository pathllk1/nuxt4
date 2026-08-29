import { useRedis } from '../utils/redis';
import { CouchbaseService } from '../utils/couchbase';
import type { ChatMessage, ChatReplyContext, ChatForwardContext, ChatAttachment } from '../../app/types/chat';

export class ChatService {
  /**
   * Deterministic Chat ID Strategy: sorts user IDs alphabetically
   */
  static getChatId(userIdA: string, userIdB: string): string {
    return [userIdA, userIdB].sort().join(':');
  }

  /**
   * Silently record user activity timestamp in Redis (0 extra Vercel invocations)
   */
  static async recordActivity(userId: string): Promise<void> {
    if (!userId) return;
    try {
      const redis = useRedis();
      if (redis) {
        await redis.hset('chat:user:last_seen', { [userId]: Date.now() });
      }
    } catch {
      // Non-critical: never fail main chat flow if presence write fails
    }
  }

  /**
   * Get all users' last active timestamps from Redis
   */
  static async getLastSeenMap(): Promise<Record<string, string>> {
    try {
      const redis = useRedis();
      if (redis) {
        return (await redis.hgetall('chat:user:last_seen')) || {};
      }
    } catch {
      // Non-critical
    }
    return {};
  }

  /**
   * Send a message: writes to Couchbase permanent storage and Upstash Redis rolling cache
   */
  static async sendMessage(params: {
    senderId: string;
    senderName: string;
    recipientId: string;
    content?: string;
    replyTo?: ChatReplyContext | null;
    forwardedFrom?: ChatForwardContext | null;
    attachments?: ChatAttachment[];
  }): Promise<ChatMessage> {
    const { senderId, senderName, recipientId, content = '', replyTo, forwardedFrom, attachments } = params;

    // Record sender activity
    this.recordActivity(senderId);

    const chatId = this.getChatId(senderId, recipientId);
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const timestamp = Date.now();

    const messagePayload: ChatMessage = {
      type: 'message',
      chatId,
      messageId,
      senderId,
      recipientId,
      senderName,
      content: (content || '').trim(),
      timestamp,
      replyTo: replyTo || null,
      forwardedFrom: forwardedFrom || null,
      reactions: {},
      status: 'delivered',
      attachments: attachments && attachments.length > 0 ? attachments : undefined
    };

    // 1. Push to Upstash Redis hot-cache list (last 50 messages)
    const redis = useRedis();
    if (redis) {
      const cacheKey = `chat:${chatId}`;
      await redis.lpush(cacheKey, JSON.stringify(messagePayload));
      await redis.ltrim(cacheKey, 0, 49);

      // Increment recipient's unread counter for this chat
      await redis.hincrby(`chat:unread:${recipientId}`, chatId, 1);

      // Update active conversation lists for both participants
      await redis.zadd(`chat:user:${recipientId}:active_chats`, { score: timestamp, member: chatId });
      await redis.zadd(`chat:user:${senderId}:active_chats`, { score: timestamp, member: chatId });
    }

    // 2. Save permanently to Couchbase Capella archive
    try {
      await CouchbaseService.saveMessage(messagePayload);
    } catch (cbErr: any) {
      console.warn('[Chat] Couchbase saveMessage notice:', cbErr.message);
    }

    return messagePayload;
  }

  /**
   * Toggle reaction on a message
   */
  static async toggleReaction(params: {
    chatId: string;
    messageId: string;
    emoji: string;
    userId: string;
  }): Promise<Record<string, string[]>> {
    const { chatId, messageId, emoji, userId } = params;

    // Record user activity
    this.recordActivity(userId);

    // 1. Update in Couchbase Capella (safe try/catch)
    let updatedReactions: Record<string, string[]> = {};
    try {
      updatedReactions = await CouchbaseService.updateReaction(messageId, emoji, userId);
    } catch (cbErr: any) {
      console.warn('[Chat] Couchbase updateReaction notice:', cbErr.message);
    }

    // 2. Update hot message inside Upstash Redis rolling list
    const redis = useRedis();
    if (redis) {
      const cacheKey = `chat:${chatId}`;
      const rawMessages: any[] = await redis.lrange(cacheKey, 0, 49);

      for (let i = 0; i < rawMessages.length; i++) {
        const item = typeof rawMessages[i] === 'string' ? JSON.parse(rawMessages[i]) : rawMessages[i];
        if (item && item.messageId === messageId) {
          item.reactions = updatedReactions;
          await redis.lset(cacheKey, i, JSON.stringify(item));
          break;
        }
      }
    }

    return updatedReactions;
  }

  /**
   * Delete a message: updates Couchbase archive and Upstash Redis hot cache
   */
  static async deleteMessage(params: {
    chatId: string;
    messageId: string;
    userId: string;
  }): Promise<{ success: boolean; messageId: string }> {
    const { chatId, messageId, userId } = params;

    // Record user activity
    this.recordActivity(userId);

    // 1. Update in Upstash Redis rolling list
    const redis = useRedis();
    if (redis) {
      const cacheKey = `chat:${chatId}`;
      const rawMessages: any[] = await redis.lrange(cacheKey, 0, 49);

      for (let i = 0; i < rawMessages.length; i++) {
        const item = typeof rawMessages[i] === 'string' ? JSON.parse(rawMessages[i]) : rawMessages[i];
        if (item && item.messageId === messageId) {
          // Security check: only the original sender can delete the message
          if (item.senderId !== userId) {
            throw new Error('Unauthorized: You can only delete your own messages');
          }
          item.isDeleted = true;
          item.content = 'This message was deleted';
          item.reactions = {};
          item.deletedAt = Date.now();
          await redis.lset(cacheKey, i, JSON.stringify(item));
          break;
        }
      }
    }

    // 2. Mark as deleted in Couchbase Capella archive
    try {
      await CouchbaseService.deleteMessage(messageId);
    } catch (cbErr: any) {
      console.warn('[Chat] Couchbase deleteMessage notice:', cbErr.message);
    }

    return { success: true, messageId };
  }

  /**
   * Forward a message to one or more recipient IDs
   */
  static async forwardMessage(params: {
    senderId: string;
    senderName: string;
    sourceMessageId: string;
    targetRecipientIds: string[];
  }): Promise<ChatMessage[]> {
    const { senderId, senderName, sourceMessageId, targetRecipientIds } = params;

    // 1. Fetch original message from Couchbase
    let original: any = null;
    try {
      original = await CouchbaseService.getMessage(sourceMessageId);
    } catch (cbErr: any) {
      console.warn('[Chat] Couchbase getMessage notice:', cbErr.message);
    }

    if (!original) {
      throw new Error('Original message not found');
    }

    const forwardedMessages: ChatMessage[] = [];

    // 2. Dispatch to each target recipient
    for (const recipientId of targetRecipientIds) {
      const forwardedMsg = await this.sendMessage({
        senderId,
        senderName,
        recipientId,
        content: original.content,
        forwardedFrom: {
          originalMessageId: original.messageId,
          originalSenderId: original.senderId,
          originalSenderName: original.senderName || 'Sender',
          originalTimestamp: original.timestamp
        }
      });
      forwardedMessages.push(forwardedMsg);
    }

    return forwardedMessages;
  }

  /**
   * Mark messages as read and clear unread counter
   */
  static async markChatAsRead(currentUserId: string, chatId: string): Promise<void> {
    // Record user activity
    this.recordActivity(currentUserId);

    // 1. Clear unread counter in Upstash Redis
    const redis = useRedis();
    if (redis) {
      await redis.hdel(`chat:unread:${currentUserId}`, chatId);

      // Update status in hot cache messages sent by the partner
      const cacheKey = `chat:${chatId}`;
      const rawMessages: any[] = await redis.lrange(cacheKey, 0, 49);

      for (let i = 0; i < rawMessages.length; i++) {
        const item = typeof rawMessages[i] === 'string' ? JSON.parse(rawMessages[i]) : rawMessages[i];
        if (item && item.recipientId === currentUserId && item.status !== 'read') {
          item.status = 'read';
          item.readAt = Date.now();
          await redis.lset(cacheKey, i, JSON.stringify(item));
        }
      }
    }

    // 2. Update status in Couchbase Capella (safe try/catch)
    try {
      await CouchbaseService.updateStatus(chatId, currentUserId, 'read');
    } catch (cbErr: any) {
      console.warn('[Chat] Couchbase updateStatus notice:', cbErr.message);
    }
  }

  /**
   * Retrieve historical messages from Couchbase Capella
   */
  static async getHistory(chatId: string, beforeTimestamp: number, limit = 30): Promise<ChatMessage[]> {
    return await CouchbaseService.getHistory(chatId, beforeTimestamp, limit);
  }
}
