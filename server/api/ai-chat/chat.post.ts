import { defineEventHandler, readBody, createError, setResponseHeader, sendStream } from 'h3';
import { Readable } from 'stream';
import { streamChat } from '../../utils/ai-chat/aiChatService';
import { requireAuthSession } from '../../utils/auth';

export default defineEventHandler(async (event) => {
  const auth = await requireAuthSession(event);
  const userId = auth._id.toString();

  const body = await readBody(event);
  const { conversationId, message, provider, model, apiKey, tavilyApiKey, searchMode } = body || {};

  if (!message || !provider || !model || !apiKey) {
    throw createError({ statusCode: 400, statusMessage: 'Message, provider, model, and API key are required' });
  }

  setResponseHeader(event, 'Content-Type', 'text/event-stream');
  setResponseHeader(event, 'Cache-Control', 'no-cache');
  setResponseHeader(event, 'Connection', 'keep-alive');
  setResponseHeader(event, 'X-Accel-Buffering', 'no');

  const stream = streamChat(userId, {
    conversationId,
    message,
    provider,
    model,
    apiKey,
    tavilyApiKey,
    searchMode,
  });

  async function* sseGenerator() {
    try {
      for await (const chunk of stream) {
        const eventData = JSON.stringify({
          content: chunk.content,
          done: chunk.done,
          error: chunk.error,
          conversationId: chunk.conversationId,
          tokensUsed: chunk.tokensUsed,
          webSearchUsed: (chunk as any).webSearchUsed || undefined,
          searchSources: (chunk as any).searchSources || undefined,
        });
        yield `data: ${eventData}\n\n`;
      }
      yield 'data: [DONE]\n\n';
    } catch (err: any) {
      console.error('[AI Chat] Stream error:', err.message);
      const errorData = JSON.stringify({
        content: '',
        done: true,
        error: JSON.stringify({
          type: 'STREAM_ERROR',
          message: err.message || 'Stream failed',
        }),
      });
      yield `data: ${errorData}\n\n`;
      yield 'data: [DONE]\n\n';
    }
  }

  return sendStream(event, Readable.from(sseGenerator()));
});
