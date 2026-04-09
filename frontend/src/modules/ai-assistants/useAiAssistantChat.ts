import { useCallback, useEffect, useRef, useState } from 'react';
import { apiDelete, apiGet, ensureAccessToken } from '../../lib/api';

const API_BASE = (import.meta as any).env?.VITE_API_URL || '/api';
const NEW_CHAT_ID = '__new__';

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  fileName?: string;
}

interface UploadResult {
  filename: string;
  textContent: string;
  truncated: boolean;
}

export function getInitialSessionId(sessionId: string | null) {
  return sessionId === NEW_CHAT_ID ? null : sessionId;
}

export function useAiAssistantChat(assistantId: string, sessionId: string | null, onSessionIdChange: (sessionId: string) => void) {
  const [messages, setMessages] = useState<AiChatMessage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activeSessionIdRef = useRef<string | null>(getInitialSessionId(sessionId));
  const streamedContentRef = useRef('');

  useEffect(() => {
    const nextSessionId = getInitialSessionId(sessionId);
    activeSessionIdRef.current = nextSessionId;

    if (!nextSessionId) {
      setMessages([]);
      return;
    }

    setIsLoadingHistory(true);
    apiGet<Array<{ id: string; role: string; content: string; createdAt: string }>>(`/ai/chat/sessions/${nextSessionId}/messages`)
      .then((history) => {
        setMessages(history.map((message) => ({
          id: message.id,
          role: message.role as 'user' | 'assistant',
          content: message.content,
          createdAt: message.createdAt,
        })));
        setError(null);
      })
      .catch((err) => {
        setError(err?.message || 'Nachrichten konnten nicht geladen werden');
      })
      .finally(() => setIsLoadingHistory(false));
  }, [sessionId]);

  const sendMessage = useCallback(async (message: string, fileContext?: string, fileName?: string) => {
    const trimmed = message.trim();
    if (!trimmed || isStreaming) {
      return;
    }

    const userMessage: AiChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
      fileName,
    };

    const assistantMessage: AiChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
    };

    setMessages((current) => [...current, userMessage, assistantMessage]);
    setIsStreaming(true);
    setError(null);
    streamedContentRef.current = '';

    try {
      const accessToken = await ensureAccessToken();
      if (!accessToken) {
        throw new Error('Session abgelaufen');
      }

      const response = await fetch(`${API_BASE}/ai/chat/${assistantId}/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          message: trimmed,
          sessionId: activeSessionIdRef.current ?? undefined,
          fileContext,
        }),
      });

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || `Stream fehlgeschlagen (${response.status})`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) {
            continue;
          }

          const raw = line.slice(6).trim();
          if (!raw) {
            continue;
          }

          try {
            const event = JSON.parse(raw) as
              | { type: 'session'; sessionId: string }
              | { type: 'chunk'; content: string }
              | { type: 'done'; sessionId: string }
              | { type: 'error'; error: string };

            if (event.type === 'session') {
              activeSessionIdRef.current = event.sessionId;
              onSessionIdChange(event.sessionId);
            }

            if (event.type === 'chunk' && event.content) {
              streamedContentRef.current += event.content;
              setMessages((current) => {
                const nextMessages = [...current];
                const lastIndex = nextMessages.length - 1;
                if (lastIndex >= 0 && nextMessages[lastIndex].role === 'assistant') {
                  nextMessages[lastIndex] = {
                    ...nextMessages[lastIndex],
                    content: streamedContentRef.current,
                  };
                }
                return nextMessages;
              });
            }

            if (event.type === 'error') {
              throw new Error(event.error);
            }
          } catch (err) {
            throw err instanceof Error ? err : new Error('Streaming-Fehler');
          }
        }
      }
    } catch (err) {
      const messageText = err instanceof Error ? err.message : 'Chat konnte nicht gesendet werden';
      setError(messageText);
      setMessages((current) => current.map((entry, index) => (
        index === current.length - 1 && entry.role === 'assistant'
          ? { ...entry, content: `Fehler: ${messageText}` }
          : entry
      )));
    } finally {
      setIsStreaming(false);
    }
  }, [assistantId, isStreaming, onSessionIdChange]);

  const uploadFile = useCallback(async (file: File): Promise<UploadResult> => {
    setIsUploadingFile(true);
    try {
      const accessToken = await ensureAccessToken();
      if (!accessToken) {
        throw new Error('Session abgelaufen');
      }

      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (['txt', 'md', 'csv', 'xml', 'json'].includes(ext)) {
        const textContent = await file.text();
        const truncated = textContent.length > 15_000;
        return {
          filename: file.name,
          textContent: truncated ? `${textContent.slice(0, 15_000)}\n\n[... Datei gekuerzt ...]` : textContent,
          truncated,
        };
      }

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE}/ai/assistants/${assistantId}/chat-upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: formData,
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message || 'Datei konnte nicht gelesen werden');
      }

      return payload.data as UploadResult;
    } finally {
      setIsUploadingFile(false);
    }
  }, [assistantId]);

  const deleteSession = useCallback(async () => {
    if (!activeSessionIdRef.current) {
      setMessages([]);
      return;
    }

    await apiDelete(`/ai/chat/sessions/${activeSessionIdRef.current}`);
    activeSessionIdRef.current = null;
    setMessages([]);
  }, []);

  return {
    messages,
    isLoadingHistory,
    isStreaming,
    isUploadingFile,
    error,
    sendMessage,
    uploadFile,
    deleteSession,
  };
}

export { NEW_CHAT_ID };
