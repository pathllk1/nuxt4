export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  isFree: boolean;
  contextWindow?: number;
  description?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatParams {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
  temperature?: number;
  maxTokens?: number;
}

export interface ChatChunk {
  content: string;
  done: boolean;
  error?: string;
  tokensUsed?: number;
}

export interface AIProvider {
  readonly name: string;
  readonly displayName: string;

  validateKey(apiKey: string): Promise<boolean>;
  listModels(apiKey: string): Promise<ModelInfo[]>;
  chat(params: ChatParams): AsyncGenerator<ChatChunk, void, unknown>;
}

export function parseRateLimitError(status: number, headers?: Record<string, string>, body?: any): number | null {
  if (status !== 429) return null;

  const retryAfter = headers?.['retry-after'] || headers?.['Retry-After'];
  if (retryAfter) {
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds)) return seconds;
  }

  if (body?.error?.message) {
    const match = body.error.message.match(/try again in (\d+(\.\d+)?)\s*s/i);
    if (match) return Math.ceil(parseFloat(match[1]));
  }

  return 60;
}
