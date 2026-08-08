import { defineEventHandler } from 'h3';
import { getAvailableProviders } from '../../utils/ai-chat/aiChatService';
import { requireAuthSession } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  await requireAuthSession(event);
  const providers = getAvailableProviders();
  return {
    success: true,
    data: providers,
    message: 'Available AI providers'
  };
});
