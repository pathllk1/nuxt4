import { parseRateLimitError, type AIProvider, type ChatParams, type ChatChunk, type ModelInfo } from './base';

export class GeminiProvider implements AIProvider {
  readonly name = 'gemini';
  readonly displayName = 'Google Gemini';

  private readonly baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  async validateKey(apiKey: string): Promise<boolean> {
    try {
      const res = await fetch(
        `${this.baseUrl}/models?key=${apiKey}`,
        { method: 'GET', signal: AbortSignal.timeout(10000) }
      );
      return res.ok;
    } catch {
      return false;
    }
  }

  async listModels(apiKey: string): Promise<ModelInfo[]> {
    try {
      const res = await fetch(
        `${this.baseUrl}/models?key=${apiKey}`,
        { method: 'GET', signal: AbortSignal.timeout(15000) }
      );
      if (!res.ok) return this.getDefaultModels();

      const data = await res.json();
      const models: ModelInfo[] = [];

      for (const m of data.models || []) {
        if (!m.supportedGenerationMethods?.includes('generateContent')) continue;

        const id = m.name?.replace('models/', '') || '';
        if (!id) continue;

        models.push({
          id,
          name: m.displayName || id,
          provider: this.name,
          isFree: this.isFreeModel(id),
          contextWindow: m.inputTokenLimit,
          description: m.description?.substring(0, 200),
        });
      }

      models.sort((a, b) => {
        if (a.isFree !== b.isFree) return a.isFree ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      return models.length > 0 ? models : this.getDefaultModels();
    } catch {
      return this.getDefaultModels();
    }
  }

  async *chat(params: ChatParams): AsyncGenerator<ChatChunk, void, unknown> {
    const { apiKey, model, messages, signal } = params;

    const geminiContents = this.convertMessages(messages);
    const url = `${this.baseUrl}/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`;

    const body = JSON.stringify({
      contents: geminiContents,
      generationConfig: {
        temperature: params.temperature ?? 0.7,
        maxOutputTokens: params.maxTokens ?? 8192,
      },
    });

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal,
      });
    } catch (err: any) {
      if (err.name === 'AbortError') {
        yield { content: '', done: true };
        return;
      }
      throw err;
    }

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const retryAfter = parseRateLimitError(response.status, Object.fromEntries(response.headers.entries()), errorBody);
      if (retryAfter !== null) {
        yield {
          content: '',
          done: true,
          error: JSON.stringify({
            type: 'RATE_LIMITED',
            provider: this.name,
            retryAfter,
            message: `Gemini rate limit reached. Try again in ${retryAfter}s or switch to another provider.`,
          }),
        };
        return;
      }
      throw new Error(errorBody?.error?.message || `Gemini API error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body from Gemini');

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr || jsonStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            if (text) {
              yield { content: text, done: false };
            }

            const finishReason = parsed?.candidates?.[0]?.finishReason;
            if (finishReason && finishReason !== 'STOP' && finishReason !== 'MAX_TOKENS') {
              if (finishReason === 'SAFETY') {
                yield { content: '\n\n⚠️ Response blocked by safety filters.', done: false };
              }
            }
          } catch {
            // Skip malformed JSON chunks
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { content: '', done: true };
  }

  private convertMessages(messages: { role: string; content: string }[]) {
    const contents: any[] = [];

    for (const msg of messages) {
      if (msg.role === 'system') {
        contents.push({
          role: 'user',
          parts: [{ text: `[System Instruction]: ${msg.content}` }],
        });
        contents.push({
          role: 'model',
          parts: [{ text: 'Understood. I will follow these instructions.' }],
        });
      } else {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        });
      }
    }

    return contents;
  }

  private isFreeModel(id: string): boolean {
    const freePatterns = ['flash', 'flash-lite'];
    return freePatterns.some(p => id.toLowerCase().includes(p));
  }

  private getDefaultModels(): ModelInfo[] {
    return [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: this.name, isFree: true, contextWindow: 1048576 },
      { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash Lite', provider: this.name, isFree: true, contextWindow: 1048576 },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: this.name, isFree: true, contextWindow: 1048576 },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: this.name, isFree: false, contextWindow: 2097152 },
    ];
  }
}
