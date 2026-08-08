import { defineEventHandler, readBody, createError } from 'h3';
import { createConversation } from '../../../utils/ai-chat/aiChatService';
import { requireAuthSession } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  const auth = await requireAuthSession(event);
  const userId = auth._id.toString();

  const body = await readBody(event);
  const { title, provider, model } = body || {};

  if (!provider || !model) {
    throw createError({ statusCode: 400, statusMessage: 'Provider and model are required' });
  }

  const conv = await createConversation(userId, title || 'New Chat', provider, model);
  return {
    success: true,
    data: conv,
    message: 'Conversation created'
  };
});
