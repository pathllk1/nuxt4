import { parseRateLimitError, type AIProvider, type ChatParams, type ChatChunk, type ModelInfo } from './base';

export class OpenRouterProvider implements AIProvider {
  readonly name = 'openrouter';
  readonly displayName = 'OpenRouter';

  private readonly baseUrl = 'https://openrouter.ai/api/v1';

  async validateKey(apiKey: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/auth/key`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return false;
      const data = await res.json();
      return !!data?.data;
    } catch {
      return false;
    }
  }

  async listModels(apiKey: string): Promise<ModelInfo[]> {
    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) return this.getDefaultModels();

      const data = await res.json();
      const models: ModelInfo[] = [];

      for (const m of data.data || []) {
        const isFree = m.id?.includes(':free') ||
          (m.pricing?.prompt === '0' && m.pricing?.completion === '0');

        models.push({
          id: m.id,
          name: m.name || m.id,
          provider: this.name,
          isFree,
          contextWindow: m.context_length,
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

    const body = JSON.stringify({
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      temperature: params.temperature ?? 0.7,
      max_tokens: params.maxTokens || undefined,
      stream: true,
    });

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://erp-app.local',
          'X-Title': 'ERP AI Chat',
        },
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
            message: `OpenRouter rate limit reached. Try again in ${retryAfter}s or switch to another provider.`,
          }),
        };
        return;
      }
      throw new Error(errorBody?.error?.message || `OpenRouter API error: ${response.status}`);
    }

    yield* this.parseOpenAIStream(response);
  }

  private async *parseOpenAIStream(response: Response): AsyncGenerator<ChatChunk, void, unknown> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body from OpenRouter');

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
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          const jsonStr = trimmed.slice(6);
          if (jsonStr === '[DONE]') {
            yield { content: '', done: true };
            return;
          }

          try {
            const parsed = JSON.parse(jsonStr);

            if (parsed.error) {
              yield {
                content: '',
                done: true,
                error: JSON.stringify({
                  type: 'PROVIDER_ERROR',
                  provider: this.name,
                  message: parsed.error.message || 'Unknown error from OpenRouter',
                }),
              };
              return;
            }

            const content = parsed.choices?.[0]?.delta?.content || '';
            if (content) {
              yield { content, done: false };
            }

            if (parsed.choices?.[0]?.finish_reason) {
              yield {
                content: '',
                done: true,
                tokensUsed: parsed.usage?.total_tokens,
              };
              return;
            }
          } catch {
            // Skip malformed chunks
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { content: '', done: true };
  }

  private getDefaultModels(): ModelInfo[] {
    return [
      { id: 'google/gemma-3-4b-it:free', name: 'Gemma 3 4B (Free)', provider: this.name, isFree: true, contextWindow: 131072 },
      { id: 'meta-llama/llama-4-scout:free', name: 'Llama 4 Scout (Free)', provider: this.name, isFree: true, contextWindow: 131072 },
      { id: 'qwen/qwen3-32b:free', name: 'Qwen 3 32B (Free)', provider: this.name, isFree: true, contextWindow: 40960 },
      { id: 'mistralai/mistral-small-3.1-24b-instruct:free', name: 'Mistral Small 3.1 24B (Free)', provider: this.name, isFree: true, contextWindow: 131072 },
      { id: 'deepseek/deepseek-r1-0528:free', name: 'DeepSeek R1 (Free)', provider: this.name, isFree: true, contextWindow: 65536 },
    ];
  }
}
