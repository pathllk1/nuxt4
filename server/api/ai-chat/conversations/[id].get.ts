import { defineEventHandler, createError } from 'h3';
import { getConversation } from '../../../utils/ai-chat/aiChatService';
import { requireAuthSession } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  const auth = await requireAuthSession(event);
  const userId = auth._id.toString();

  const id = event.context.params?.id;
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Conversation ID is required' });
  }

  const data = await getConversation(id, userId);
  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'Conversation not found' });
  }

  return {
    success: true,
    data,
    message: 'Conversation retrieved'
  };
});
