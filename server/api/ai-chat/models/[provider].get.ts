import { defineEventHandler, getQuery, createError } from 'h3';
import { getModels } from '../../../utils/ai-chat/aiChatService';
import { requireAuthSession } from '../../../utils/auth';

export default defineEventHandler(async (event) => {
  await requireAuthSession(event);
  const provider = event.context.params?.provider;
  const query = getQuery(event);
  const apiKey = query.apiKey as string;

  if (!provider) {
    throw createError({ statusCode: 400, statusMessage: 'Provider is required' });
  }

  if (!apiKey) {
    throw createError({ statusCode: 400, statusMessage: 'API key is required' });
  }

  try {
    const models = await getModels(provider, apiKey);
    return {
      success: true,
      data: models,
      message: 'Available models'
    };
  } catch (err: any) {
    throw createError({ statusCode: 400, statusMessage: err.message || 'Failed to fetch models' });
  }
});
