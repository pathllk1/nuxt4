import { defineEventHandler, readBody, createError } from 'h3';
import { stopGeneration } from '../../../utils/ai-chat/aiChatService';
import { requireAuthSession } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  await requireAuthSession(event);
  const body = await readBody(event);
  const { conversationId } = body || {};

  if (!conversationId) {
    throw createError({ statusCode: 400, statusMessage: 'Conversation ID is required' });
  }

  const stopped = stopGeneration(conversationId);
  return {
    success: true,
    data: { stopped },
    message: stopped ? 'Generation stopped' : 'No active generation found'
  };
});
