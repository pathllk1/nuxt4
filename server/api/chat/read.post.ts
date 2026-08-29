import { defineEventHandler, readBody, createError } from 'h3';
import { ChatService } from '../../services/chatService';

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user || (!user.id && !user._id)) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  const currentUserId = (user.id || user._id).toString();
  const body = await readBody(event);
  const { chatId } = body;

  if (!chatId) {
    throw createError({ statusCode: 400, statusMessage: 'chatId is required' });
  }

  if (!chatId.split(':').includes(currentUserId)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
  }

  try {
    await ChatService.markChatAsRead(currentUserId, chatId);

    return {
      success: true
    };
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to mark chat as read'
    });
  }
});
