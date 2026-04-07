import type { LLMAdapter } from './base.js';
import { OpenAIAdapter } from './openai.js';
import { AnthropicAdapter } from './anthropic.js';
import { GeminiAdapter } from './gemini.js';

export type { LLMAdapter, ChatMessage, StreamChunk } from './base.js';

export function createAdapter(type: string, apiKey: string): LLMAdapter {
  switch (type) {
    case 'openai':
      return new OpenAIAdapter(apiKey);
    case 'anthropic':
      return new AnthropicAdapter(apiKey);
    case 'gemini':
      return new GeminiAdapter(apiKey);
    default:
      throw new Error(`Unbekannter Provider-Typ: ${type}`);
  }
}
