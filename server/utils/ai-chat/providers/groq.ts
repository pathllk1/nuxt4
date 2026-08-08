import { parseRateLimitError, type AIProvider, type ChatParams, type ChatChunk, type ModelInfo } from './base';

export class GroqProvider implements AIProvider {
  readonly name = 'groq';
  readonly displayName = 'Groq';

  private readonly baseUrl = 'https://api.groq.com/openai/v1';

  async validateKey(apiKey: string): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(10000),
      });
      return res.ok;
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
        if (m.id?.includes('whisper') || m.id?.includes('distil') || m.id?.includes('tool-use')) continue;

        models.push({
          id: m.id,
          name: this.formatModelName(m.id),
          provider: this.name,
          isFree: true,
          contextWindow: m.context_window,
        });
      }

      models.sort((a, b) => a.name.localeCompare(b.name));
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
            message: `Groq rate limit reached. Try again in ${retryAfter}s or switch to another provider.`,
          }),
        };
        return;
      }
      throw new Error(errorBody?.error?.message || `Groq API error: ${response.status}`);
    }

    yield* this.parseOpenAIStream(response);
  }

  private async *parseOpenAIStream(response: Response): AsyncGenerator<ChatChunk, void, unknown> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body from Groq');

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

  private formatModelName(id: string): string {
    return id
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
      .replace(/(\d)b/gi, '$1B');
  }

  private getDefaultModels(): ModelInfo[] {
    return [
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', provider: this.name, isFree: true, contextWindow: 131072 },
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', provider: this.name, isFree: true, contextWindow: 131072 },
      { id: 'gemma2-9b-it', name: 'Gemma 2 9B IT', provider: this.name, isFree: true, contextWindow: 8192 },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', provider: this.name, isFree: true, contextWindow: 32768 },
    ];
  }
}
