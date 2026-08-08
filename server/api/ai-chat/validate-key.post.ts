import { defineEventHandler, readBody, createError } from 'h3';
import { validateApiKey } from '../../utils/ai-chat/aiChatService';
import { requireAuthSession } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  await requireAuthSession(event);
  const body = await readBody(event);
  const { provider, apiKey } = body || {};

  if (!provider || !apiKey) {
    throw createError({ statusCode: 400, statusMessage: 'Provider and API key are required' });
  }

  try {
    const valid = await validateApiKey(provider, apiKey);
    return {
      success: true,
      data: { valid },
      message: valid ? 'API key is valid' : 'API key is invalid'
    };
  } catch (err: any) {
    throw createError({ statusCode: 400, statusMessage: err.message || 'Validation failed' });
  }
});
