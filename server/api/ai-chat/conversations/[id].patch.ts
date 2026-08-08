import { defineEventHandler, readBody, createError } from 'h3';
import { updateConversation } from '../../../utils/ai-chat/aiChatService';
import { requireAuthSession } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  const auth = await requireAuthSession(event);
  const userId = auth._id.toString();

  const id = event.context.params?.id;
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Conversation ID is required' });
  }

  const updates = await readBody(event);
  const conv = await updateConversation(id, userId, updates || {});
  if (!conv) {
    throw createError({ statusCode: 404, statusMessage: 'Conversation not found' });
  }

  return {
    success: true,
    data: conv,
    message: 'Conversation updated'
  };
});
