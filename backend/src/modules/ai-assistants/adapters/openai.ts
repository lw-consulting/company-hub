import type { LLMAdapter, ChatMessage, StreamChunk } from './base.js';

export class OpenAIAdapter implements LLMAdapter {
  constructor(private apiKey: string) {}

  async chat(messages: ChatMessage[], options: { model: string; temperature?: number; maxTokens?: number; topP?: number }): Promise<string> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options.model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2048,
        top_p: options.topP ?? 1,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`OpenAI API error: ${err.error?.message || res.statusText}`);
    }

    const data = await res.json();
    return data.choices[0]?.message?.content || '';
  }

  async *chatStream(messages: ChatMessage[], options: { model: string; temperature?: number; maxTokens?: number; topP?: number }): AsyncGenerator<StreamChunk> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options.model,
        messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2048,
        top_p: options.topP ?? 1,
        stream: true,
      }),
    });

    if (!res.ok || !res.body) {
      throw new Error(`OpenAI stream error: ${res.statusText}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') { yield { content: '', done: true }; return; }

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices[0]?.delta?.content || '';
          if (content) yield { content, done: false };
        } catch {}
      }
    }
    yield { content: '', done: true };
  }
}
