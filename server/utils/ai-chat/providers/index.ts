import type { AIProvider } from './base';
import { GeminiProvider } from './gemini';
import { GroqProvider } from './groq';
import { OpenRouterProvider } from './openrouter';

const providers: Record<string, AIProvider> = {
  gemini: new GeminiProvider(),
  groq: new GroqProvider(),
  openrouter: new OpenRouterProvider(),
};

export function getProvider(name: string): AIProvider {
  const provider = providers[name.toLowerCase()];
  if (!provider) {
    throw new Error(`Unknown AI provider: "${name}". Available: ${Object.keys(providers).join(', ')}`);
  }
  return provider;
}

export function listProviders(): Array<{ id: string; name: string }> {
  return Object.entries(providers).map(([id, p]) => ({
    id,
    name: p.displayName,
  }));
}

