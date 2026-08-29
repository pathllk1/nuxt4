import { defineEventHandler, readBody, createError } from 'h3';
import { ChatService } from '../../services/chatService';

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user || (!user.id && !user._id)) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  const senderId = (user.id || user._id).toString();
  const senderName = user.name || user.username || user.email?.split('@')[0] || 'User';

  const body = await readBody(event);
  const { sourceMessageId, targetRecipientIds } = body;

  if (!sourceMessageId || !Array.isArray(targetRecipientIds) || targetRecipientIds.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'sourceMessageId and targetRecipientIds array are required' });
  }

  try {
    const forwardedMessages = await ChatService.forwardMessage({
      senderId,
      senderName,
      sourceMessageId,
      targetRecipientIds
    });

    return {
      success: true,
      count: forwardedMessages.length,
      messages: forwardedMessages
    };
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to forward message'
    });
  }
});
