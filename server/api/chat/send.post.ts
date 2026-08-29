import { defineEventHandler, readBody, createError } from 'h3';
import { ChatService } from '../../services/chatService';

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user || (!user.id && !user._id)) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized: Authentication required' });
  }

  const senderId = (user.id || user._id).toString();
  const senderName = user.name || user.username || user.email?.split('@')[0] || 'User';

  const body = await readBody(event);
  const { recipientId, content, replyTo, forwardedFrom } = body;

  if (!recipientId || !content || !content.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Recipient and message content are required' });
  }

  try {
    const message = await ChatService.sendMessage({
      senderId,
      senderName,
      recipientId: recipientId.toString(),
      content: content.trim(),
      replyTo: replyTo || null,
      forwardedFrom: forwardedFrom || null
    });

    return {
      success: true,
      message
    };
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to send message'
    });
  }
});
