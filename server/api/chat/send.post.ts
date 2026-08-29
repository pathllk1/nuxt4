import { defineEventHandler, readBody, createError } from 'h3';
import { ChatService } from '../../services/chatService';

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user || (!user.id && !user._id)) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized: Authentication required' });
  }

  const senderId = (user.id || user._id).toString();
  const senderName = user.name || user.username || user.email?.split('@')[0] || 'User';

  const body = await readBody(event).catch(() => ({}));
  const { recipientId, replyTo, forwardedFrom } = body;
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  const attachments = Array.isArray(body.attachments) ? body.attachments : [];

  if (!recipientId) {
    throw createError({ statusCode: 400, statusMessage: 'Recipient is required' });
  }

  if (!content && attachments.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'Either message text or an attachment is required' });
  }

  try {
    const message = await ChatService.sendMessage({
      senderId,
      senderName,
      recipientId: recipientId.toString(),
      content,
      replyTo: replyTo || null,
      forwardedFrom: forwardedFrom || null,
      attachments: attachments.length > 0 ? attachments : undefined
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
