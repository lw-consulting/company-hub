import type { LLMAdapter, ChatMessage, StreamChunk } from './base.js';

export class AnthropicAdapter implements LLMAdapter {
  constructor(private apiKey: string) {}

  async chat(messages: ChatMessage[], options: { model: string; temperature?: number; maxTokens?: number; topP?: number }): Promise<string> {
    const systemMsg = messages.find(m => m.role === 'system');
    const chatMsgs = messages.filter(m => m.role !== 'system');

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options.model,
        max_tokens: options.maxTokens ?? 2048,
        ...(options.temperature !== undefined ? { temperature: options.temperature } : { top_p: options.topP ?? 1 }),
        system: systemMsg?.content || undefined,
        messages: chatMsgs.map(m => ({ role: m.role, content: m.content })),
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Anthropic API error: ${err.error?.message || res.statusText}`);
    }

    const data = await res.json();
    return data.content?.[0]?.text || '';
  }

  async *chatStream(messages: ChatMessage[], options: { model: string; temperature?: number; maxTokens?: number; topP?: number }): AsyncGenerator<StreamChunk> {
    const systemMsg = messages.find(m => m.role === 'system');
    const chatMsgs = messages.filter(m => m.role !== 'system');

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options.model,
        max_tokens: options.maxTokens ?? 2048,
        ...(options.temperature !== undefined ? { temperature: options.temperature } : { top_p: options.topP ?? 1 }),
        system: systemMsg?.content || undefined,
        messages: chatMsgs.map(m => ({ role: m.role, content: m.content })),
        stream: true,
      }),
    });

    if (!res.ok || !res.body) {
      throw new Error(`Anthropic stream error: ${res.statusText}`);
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
        if (!trimmed.startsWith('data: ')) continue;

        try {
          const parsed = JSON.parse(trimmed.slice(6));
          if (parsed.type === 'content_block_delta') {
            yield { content: parsed.delta?.text || '', done: false };
          }
          if (parsed.type === 'message_stop') {
            yield { content: '', done: true }; return;
          }
        } catch {}
      }
    }
    yield { content: '', done: true };
  }
}
