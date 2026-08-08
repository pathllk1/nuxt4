import { defineEventHandler } from 'h3';
import { clearConversations } from '../../../utils/ai-chat/aiChatService';
import { requireAuthSession } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  const auth = await requireAuthSession(event);
  const userId = auth._id.toString();

  const count = await clearConversations(userId);
  return {
    success: true,
    data: { deletedCount: count },
    message: `${count} conversations deleted`
  };
});
