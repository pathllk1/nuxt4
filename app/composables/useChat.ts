import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useAuth } from './useAuth';
import type { ChatMessage, ChatContact, ChatReplyContext } from '../types/chat';

export function useChat() {
  const { user, apiFetch } = useAuth();
  const config = useRuntimeConfig();

  const contacts = ref<ChatContact[]>([]);
  const activeContact = ref<ChatContact | null>(null);
  const messages = ref<ChatMessage[]>([]);
  const loadingContacts = ref(false);
  const sending = ref(false);
  const loadingHistory = ref(false);
  const hasMoreHistory = ref(true);
  const replyingTo = ref<ChatMessage | null>(null);
  const forwardingMessage = ref<ChatMessage | null>(null);

  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let isPollingInFlight = false;

  const currentUserId = computed(() => {
    return user.value?.id || (user.value as any)?._id || null;
  });

  const activeChatId = computed(() => {
    if (!currentUserId.value || !activeContact.value) return null;
    return [currentUserId.value, activeContact.value.id].sort().join(':');
  });

  /**
   * Fetch contacts from backend
   */
  const fetchContacts = async () => {
    loadingContacts.value = true;
    try {
      const res: any = await $fetch('/api/chat/contacts');
      if (res.success && Array.isArray(res.data)) {
        contacts.value = res.data;
      }
    } catch (err) {
      console.warn('[useChat] Failed to fetch contacts:', err);
    } finally {
      loadingContacts.value = false;
    }
  };

  /**
   * Direct Upstash REST Polling for active chat
   * Generates 0 Vercel serverless function invocations
   */
  const pollActiveChat = async () => {
    if (!activeChatId.value || isPollingInFlight) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

    const upstashUrl = (config.public.upstashRedisRestUrl as string) || '';
    const readToken = (config.public.upstashRedisRestReadToken as string) || '';

    isPollingInFlight = true;

    try {
      if (upstashUrl && readToken) {
        // Direct client polling from Upstash REST
        const response = await fetch(`${upstashUrl}/lrange/chat:${activeChatId.value}/0/49`, {
          headers: {
            Authorization: `Bearer ${readToken}`
          }
        });
        const data = await response.json();
        if (data && Array.isArray(data.result)) {
          // Redis list is LPUSHed (newest first). Reverse to get chronological order.
          const freshMessages = data.result.reverse().map((item: any) => {
            return typeof item === 'string' ? JSON.parse(item) : item;
          });

          // Retain older historical messages if user scrolled up
          if (messages.value.length > freshMessages.length) {
            const freshIds = new Set(freshMessages.map((m: any) => m.messageId));
            const olderLoaded = messages.value.filter((m: any) => !freshIds.has(m.messageId));
            messages.value = [...olderLoaded, ...freshMessages];
          } else {
            messages.value = freshMessages;
          }
        }
      } else {
        // Fallback to internal route if Upstash read-only token is not configured
        const res: any = await $fetch('/api/chat/history', {
          params: { chatId: activeChatId.value, limit: 50 }
        });
        if (res.success && Array.isArray(res.data)) {
          messages.value = res.data;
        }
      }
    } catch (err) {
      console.warn('[useChat] Polling error:', err);
    } finally {
      isPollingInFlight = false;
    }
  };

  /**
   * Visibility change handler to save battery and network requests
   */
  const handleVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      pollActiveChat();
      fetchContacts();
    }
  };

  /**
   * Select a contact to open active chat
   */
  const selectContact = async (contact: ChatContact) => {
    activeContact.value = contact;
    messages.value = [];
    hasMoreHistory.value = true;
    replyingTo.value = null;

    // Reset unread count locally
    contact.unreadCount = 0;

    await pollActiveChat();

    // Notify backend that user has read partner's messages
    if (activeChatId.value) {
      try {
        await $fetch('/api/chat/read', {
          method: 'POST',
          body: { chatId: activeChatId.value }
        });
      } catch (err) {
        console.warn('[useChat] Failed to mark chat as read:', err);
      }
    }
  };

  /**
   * Send a text message with optional reply
   */
  const sendMessage = async (content: string) => {
    if (!content.trim() || !activeContact.value || !currentUserId.value) return;

    sending.value = true;

    const replyContext: ChatReplyContext | null = replyingTo.value
      ? {
          messageId: replyingTo.value.messageId,
          senderId: replyingTo.value.senderId,
          senderName: replyingTo.value.senderName || 'Partner',
          content: replyingTo.value.content
        }
      : null;

    // Optimistic message placeholder
    const tempId = `temp_${Date.now()}`;
    const optimisticMessage: ChatMessage = {
      type: 'message',
      chatId: activeChatId.value || '',
      messageId: tempId,
      senderId: currentUserId.value,
      recipientId: activeContact.value.id,
      senderName: user.value?.name || 'Me',
      content: content.trim(),
      timestamp: Date.now(),
      replyTo: replyContext,
      status: 'sending',
      reactions: {}
    };

    messages.value.push(optimisticMessage);
    const textToSend = content.trim();
    replyingTo.value = null;

    try {
      const res: any = await $fetch('/api/chat/send', {
        method: 'POST',
        body: {
          recipientId: activeContact.value.id,
          content: textToSend,
          replyTo: replyContext
        }
      });

      if (res.success && res.message) {
        const idx = messages.value.findIndex(m => m.messageId === tempId);
        if (idx !== -1) {
          messages.value[idx] = res.message;
        }
      }
    } catch (err) {
      console.error('[useChat] Failed to send message:', err);
      // Remove or mark failed
      const idx = messages.value.findIndex(m => m.messageId === tempId);
      if (idx !== -1) {
        messages.value.splice(idx, 1);
      }
    } finally {
      sending.value = false;
      pollActiveChat();
    }
  };

  /**
   * Toggle emoji reaction on a message
   */
  const toggleReaction = async (message: ChatMessage, emoji: string) => {
    if (!activeChatId.value || !currentUserId.value) return;

    // Optimistic reaction toggle
    const currentReactions = { ...(message.reactions || {}) };
    const userList = [...(currentReactions[emoji] || [])];
    const userIdx = userList.indexOf(currentUserId.value);

    if (userIdx > -1) {
      userList.splice(userIdx, 1);
      if (userList.length === 0) delete currentReactions[emoji];
      else currentReactions[emoji] = userList;
    } else {
      userList.push(currentUserId.value);
      currentReactions[emoji] = userList;
    }
    message.reactions = currentReactions;

    try {
      const res: any = await $fetch('/api/chat/react', {
        method: 'POST',
        body: {
          chatId: activeChatId.value,
          messageId: message.messageId,
          emoji
        }
      });

      if (res.success && res.reactions) {
        message.reactions = res.reactions;
      }
    } catch (err) {
      console.error('[useChat] Failed to toggle reaction:', err);
      pollActiveChat();
    }
  };

  /**
   * Forward a message to selected contacts
   */
  const forwardMessage = async (targetUserIds: string[]) => {
    if (!forwardingMessage.value || targetUserIds.length === 0) return;

    try {
      const res: any = await $fetch('/api/chat/forward', {
        method: 'POST',
        body: {
          sourceMessageId: forwardingMessage.value.messageId,
          targetRecipientIds: targetUserIds
        }
      });

      if (res.success) {
        forwardingMessage.value = null;
        pollActiveChat();
        fetchContacts();
        return true;
      }
    } catch (err) {
      console.error('[useChat] Failed to forward message:', err);
      throw err;
    }
    return false;
  };

  /**
   * Load older history beyond the 50-message Redis cache from Couchbase Capella
   */
  const loadOlderMessages = async () => {
    if (loadingHistory.value || !hasMoreHistory.value || !activeChatId.value || messages.value.length === 0) {
      return;
    }

    loadingHistory.value = true;
    try {
      const oldestTimestamp = messages.value[0]?.timestamp || Date.now();
      const res: any = await $fetch('/api/chat/history', {
        params: {
          chatId: activeChatId.value,
          beforeTimestamp: oldestTimestamp,
          limit: 30
        }
      });

      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        // Prepend older history to timeline
        messages.value = [...res.data, ...messages.value];
        hasMoreHistory.value = res.hasMore;
      } else {
        hasMoreHistory.value = false;
      }
    } catch (err) {
      console.error('[useChat] Error loading historical messages from Couchbase:', err);
    } finally {
      loadingHistory.value = false;
    }
  };

  onMounted(() => {
    fetchContacts();
    // Poll every 2.5 seconds
    pollTimer = setInterval(() => {
      pollActiveChat();
    }, 2500);

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
  });

  onUnmounted(() => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    }
  });

  return {
    contacts,
    activeContact,
    messages,
    loadingContacts,
    sending,
    loadingHistory,
    hasMoreHistory,
    replyingTo,
    forwardingMessage,
    currentUserId,
    activeChatId,
    fetchContacts,
    selectContact,
    sendMessage,
    toggleReaction,
    forwardMessage,
    loadOlderMessages
  };
}
