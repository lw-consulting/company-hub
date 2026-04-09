import type { LLMAdapter, ChatMessage, StreamChunk } from './base.js';

export class GeminiAdapter implements LLMAdapter {
  constructor(private apiKey: string) {}

  async chat(messages: ChatMessage[], options: { model: string; temperature?: number; maxTokens?: number; topP?: number }): Promise<string> {
    const systemMsg = messages.find(m => m.role === 'system');
    const chatMsgs = messages.filter(m => m.role !== 'system');

    const contents = chatMsgs.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const model = options.model || 'gemini-2.0-flash';
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: systemMsg ? { parts: [{ text: systemMsg.content }] } : undefined,
        generationConfig: {
          temperature: options.temperature ?? 0.7,
          maxOutputTokens: options.maxTokens ?? 2048,
          topP: options.topP ?? 1,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Gemini API error: ${err.error?.message || res.statusText}`);
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }

  async *chatStream(messages: ChatMessage[], options: { model: string; temperature?: number; maxTokens?: number; topP?: number }): AsyncGenerator<StreamChunk> {
    // Gemini stream via SSE
    const result = await this.chat(messages, options);
    yield { content: result, done: true };
  }
}
