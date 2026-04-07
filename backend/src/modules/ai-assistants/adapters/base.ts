export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StreamChunk {
  content: string;
  done: boolean;
}

export interface LLMAdapter {
  chat(messages: ChatMessage[], options: {
    model: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<string>;

  chatStream(messages: ChatMessage[], options: {
    model: string;
    temperature?: number;
    maxTokens?: number;
  }): AsyncGenerator<StreamChunk>;
}
