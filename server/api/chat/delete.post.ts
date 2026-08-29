import { defineEventHandler, readBody, createError } from 'h3';
import { ChatService } from '../../services/chatService';

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user || (!user.id && !user._id)) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  const currentUserId = (user.id || user._id).toString();
  const body = await readBody(event);
  const { chatId, messageId } = body;

  if (!chatId || !messageId) {
    throw createError({ statusCode: 400, statusMessage: 'chatId and messageId are required' });
  }

  // Security: Ensure user is one of the participants in this chat
  if (!chatId.split(':').includes(currentUserId)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden: You are not a participant in this conversation' });
  }

  try {
    const result = await ChatService.deleteMessage({
      chatId,
      messageId,
      userId: currentUserId
    });

    return {
      success: true,
      data: result
    };
  } catch (error: any) {
    throw createError({
      statusCode: error.message?.includes('Unauthorized') ? 403 : 500,
      statusMessage: error.message || 'Failed to delete message'
    });
  }
});
