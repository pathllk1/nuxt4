import { defineEventHandler, readBody, createError } from 'h3';
import { ChatService } from '../../services/chatService';

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user || (!user.id && !user._id)) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  const currentUserId = (user.id || user._id).toString();
  const body = await readBody(event);
  const { chatId, messageId, emoji } = body;

  if (!chatId || !messageId || !emoji) {
    throw createError({ statusCode: 400, statusMessage: 'chatId, messageId, and emoji are required' });
  }

  // Security: Ensure user is one of the participants in this chat
  if (!chatId.split(':').includes(currentUserId)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden: You are not a participant in this conversation' });
  }

  try {
    const reactions = await ChatService.toggleReaction({
      chatId,
      messageId,
      emoji,
      userId: currentUserId
    });

    return {
      success: true,
      reactions
    };
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to toggle reaction'
    });
  }
});
