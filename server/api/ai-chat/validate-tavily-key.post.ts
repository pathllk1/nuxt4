import { defineEventHandler, readBody, createError } from 'h3';
import { validateTavilyApiKey } from '../../utils/ai-chat/aiChatService';
import { requireAuthSession } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  await requireAuthSession(event);
  const body = await readBody(event);
  const { apiKey } = body || {};

  if (!apiKey) {
    throw createError({ statusCode: 400, statusMessage: 'Tavily API key is required' });
  }

  try {
    const valid = await validateTavilyApiKey(apiKey);
    return {
      success: true,
      data: { valid },
      message: valid ? 'Tavily key is valid' : 'Tavily key is invalid'
    };
  } catch (err: any) {
    throw createError({ statusCode: 400, statusMessage: err.message || 'Tavily validation failed' });
  }
});
