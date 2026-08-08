import { defineEventHandler, getQuery } from 'h3';
import { getConversations } from '../../../utils/ai-chat/aiChatService';
import { requireAuthSession } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  const auth = await requireAuthSession(event);
  const userId = auth._id.toString();

  const query = getQuery(event);
  const search = query.search as string;

  const conversations = await getConversations(userId, search);
  return {
    success: true,
    data: conversations,
    message: 'Conversations retrieved'
  };
});
