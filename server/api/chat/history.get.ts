import { defineEventHandler, getQuery, createError } from 'h3';
import { ChatService } from '../../services/chatService';

export default defineEventHandler(async (event) => {
  const user = event.context.user;
  if (!user || (!user.id && !user._id)) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  const currentUserId = (user.id || user._id).toString();
  const query = getQuery(event);
  const chatId = String(query.chatId || '');
  const beforeTimestamp = Number(query.beforeTimestamp) || Date.now();
  const limit = Math.min(Number(query.limit) || 30, 50);

  if (!chatId || !chatId.split(':').includes(currentUserId)) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden: Invalid chat conversation' });
  }

  try {
    const historicalMessages = await ChatService.getHistory(chatId, beforeTimestamp, limit);

    return {
      success: true,
      // Reverse to deliver in ascending chronological order for timeline rendering
      data: historicalMessages.reverse(),
      hasMore: historicalMessages.length === limit
    };
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to fetch message history'
    });
  }
});
