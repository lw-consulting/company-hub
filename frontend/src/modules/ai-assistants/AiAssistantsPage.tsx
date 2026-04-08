import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPatch, apiPost } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import { ROLE_HIERARCHY, type Role } from '@company-hub/shared';
import {
  ArrowLeft,
  Bot,
  FileText,
  MessageSquare,
  Paperclip,
  Plus,
  Send,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { NEW_CHAT_ID, useAiAssistantChat } from './useAiAssistantChat';

interface Assistant {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  avatarUrl: string | null;
  model: string;
  openingMessage: string | null;
}

interface ChatSession {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

interface KnowledgeDocument {
  id: string;
  filename: string;
  fileType: string;
  fileSize: number;
  includeInPrompt: boolean;
  createdAt: string;
}

export default function AiAssistantsPage() {
  const { user } = useAuthStore();
  const isAdmin = ROLE_HIERARCHY[(user?.role as Role) || 'user'] >= ROLE_HIERARCHY.admin;
  const [activeAssistant, setActiveAssistant] = useState<Assistant | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const { data: assistants, isLoading } = useQuery({
    queryKey: ['my-assistants', isAdmin],
    queryFn: () => isAdmin
      ? apiGet<Assistant[]>('/ai/assistants')
      : apiGet<Assistant[]>('/ai/my-assistants'),
  });

  if (activeAssistant && activeSessionId) {
    return (
      <ChatView
        assistant={activeAssistant}
        sessionId={activeSessionId}
        onBack={() => setActiveSessionId(null)}
        onSessionIdChange={setActiveSessionId}
      />
    );
  }

  if (activeAssistant) {
    return (
      <SessionList
        assistant={activeAssistant}
        isAdmin={isAdmin}
        onBack={() => setActiveAssistant(null)}
        onOpenSession={setActiveSessionId}
      />
    );
  }

  if (isLoading) {
    return <div className="card p-8 text-sm text-neutral-500">Assistenten werden geladen...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-neutral-900">KI-Assistenten</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Interne Assistenten mit Verlauf, Streaming und optionalem Dokumentkontext.
        </p>
      </div>

      {!assistants?.length ? (
        <div className="card p-12 text-center text-neutral-400">
          <Bot size={40} className="mx-auto mb-3 text-neutral-300" />
          <p>Keine KI-Assistenten verfuegbar.</p>
          {isAdmin && <p className="mt-2 text-sm">Lege zuerst Provider, Assistenten und Zuweisungen an.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {assistants.map((assistant) => (
            <button
              key={assistant.id}
              onClick={() => setActiveAssistant(assistant)}
              className="card p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-elevated"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/15">
                  {assistant.avatarUrl ? (
                    <img src={assistant.avatarUrl} alt="" className="h-11 w-11 rounded-2xl object-cover" />
                  ) : (
                    <Bot size={20} className="text-accent" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-semibold text-neutral-800">{assistant.name}</div>
                  <div className="truncate text-xs uppercase tracking-[0.12em] text-neutral-400">{assistant.model}</div>
                </div>
              </div>
              {assistant.description && (
                <p className="mt-4 line-clamp-3 text-sm leading-6 text-neutral-500">{assistant.description}</p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SessionList({
  assistant,
  isAdmin,
  onBack,
  onOpenSession,
}: {
  assistant: Assistant;
  isAdmin: boolean;
  onBack: () => void;
  onOpenSession: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const [showKnowledge, setShowKnowledge] = useState(false);

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['ai-sessions', assistant.id],
    queryFn: () => apiGet<ChatSession[]>(`/ai/chat/sessions?assistantId=${assistant.id}`),
  });

  const createSessionMutation = useMutation({
    mutationFn: () => apiPost<ChatSession>('/ai/chat/sessions', { assistantId: assistant.id }),
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ['ai-sessions', assistant.id] });
      onOpenSession(session.id);
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: (sessionId: string) => apiDelete(`/ai/chat/sessions/${sessionId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-sessions', assistant.id] });
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="btn-ghost p-2"><ArrowLeft size={18} /></button>
          <div>
            <h2 className="text-xl font-semibold text-neutral-900">{assistant.name}</h2>
            <p className="text-sm text-neutral-500">{assistant.description || 'Assistent mit gespeichertem Verlauf'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <button onClick={() => setShowKnowledge((current) => !current)} className="btn-ghost">
              <FileText size={16} /> Wissensbasis
            </button>
          )}
          <button onClick={() => onOpenSession(NEW_CHAT_ID)} className="btn-primary">
            <Plus size={18} /> Neuer Chat
          </button>
        </div>
      </div>

      {showKnowledge && isAdmin && <KnowledgePanel assistantId={assistant.id} />}

      <div className="space-y-3">
        {isLoading ? (
          <div className="card p-8 text-sm text-neutral-500">Verlauf wird geladen...</div>
        ) : !sessions?.length ? (
          <div className="card p-8 text-center text-neutral-400">Noch keine Chats vorhanden.</div>
        ) : (
          sessions.map((session) => (
            <div key={session.id} className="card flex items-center gap-3 p-4">
              <button
                onClick={() => onOpenSession(session.id)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-500">
                  <MessageSquare size={18} />
                </div>
                <div className="min-w-0">
                  <div className="truncate font-medium text-neutral-800">{session.title || 'Unbenannter Chat'}</div>
                  <div className="text-xs text-neutral-400">{new Date(session.updatedAt).toLocaleString('de-AT')}</div>
                </div>
              </button>
              <button
                onClick={() => deleteSessionMutation.mutate(session.id)}
                className="rounded-xl p-2 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600"
                title="Chat loeschen"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ChatView({
  assistant,
  sessionId,
  onBack,
  onSessionIdChange,
}: {
  assistant: Assistant;
  sessionId: string;
  onBack: () => void;
  onSessionIdChange: (sessionId: string) => void;
}) {
  const queryClient = useQueryClient();
  const [input, setInput] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    messages,
    isLoadingHistory,
    isStreaming,
    isUploadingFile,
    error,
    sendMessage,
    uploadFile,
    deleteSession,
  } = useAiAssistantChat(assistant.id, sessionId, (nextSessionId) => {
    onSessionIdChange(nextSessionId);
    queryClient.invalidateQueries({ queryKey: ['ai-sessions', assistant.id] });
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming || isUploadingFile) {
      return;
    }

    if (pendingFile) {
      try {
        const upload = await uploadFile(pendingFile);
        await sendMessage(input, upload.textContent, upload.filename);
      } catch (err) {
        console.error(err);
      } finally {
        setPendingFile(null);
        setInput('');
      }
      return;
    }

    await sendMessage(input);
    setInput('');
  };

  const handleDeleteCurrentSession = async () => {
    await deleteSession();
    queryClient.invalidateQueries({ queryKey: ['ai-sessions', assistant.id] });
    onBack();
  };

  return (
    <div className="grid h-[calc(100vh-8rem)] gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="card flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.16em] text-neutral-400">Assistant</div>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-neutral-900">{assistant.name}</h2>
          </div>
          <div className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${
            isStreaming ? 'bg-accent/10 text-accent' : 'bg-emerald-50 text-emerald-700'
          }`}>
            {isStreaming ? 'Antwortet' : 'Bereit'}
          </div>
        </div>

        <div className="rounded-3xl bg-neutral-50 p-4">
          <p className="text-sm leading-6 text-neutral-600">
            {assistant.openingMessage || 'Stelle Fragen, lasse Inhalte zusammenfassen oder Dokumente in den Chat einbeziehen.'}
          </p>
        </div>

        <div className="space-y-2">
          <button onClick={onBack} className="btn-ghost w-full justify-start">
            <ArrowLeft size={16} /> Zurueck zur Verlaufsliste
          </button>
          <button
            onClick={() => onSessionIdChange(NEW_CHAT_ID)}
            className="btn-primary w-full justify-start"
          >
            <Plus size={16} /> Neuer Chat
          </button>
          <button
            onClick={handleDeleteCurrentSession}
            className="btn-ghost w-full justify-start text-red-600 hover:bg-red-50"
          >
            <Trash2 size={16} /> Aktuellen Chat loeschen
          </button>
        </div>
      </aside>

      <section className="card flex min-h-0 flex-col overflow-hidden p-0">
        <div className="border-b border-neutral-200 px-5 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-neutral-400">Verlauf</div>
              <h3 className="mt-1 text-lg font-semibold text-neutral-900">Chat mit {assistant.name}</h3>
            </div>
            <div className="text-xs text-neutral-400">
              {pendingFile ? 'Datei angehaengt' : 'Streaming aktiv bei jeder Antwort'}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[linear-gradient(180deg,rgba(249,248,246,0.9)_0%,rgba(255,255,255,0.96)_100%)] px-4 py-5 sm:px-6">
          {isLoadingHistory ? (
            <div className="py-12 text-center text-sm text-neutral-500">Nachrichten werden geladen...</div>
          ) : (
            <div className="mx-auto max-w-4xl space-y-5">
              {messages.length === 0 && assistant.openingMessage && (
                <MessageBubble role="assistant" content={assistant.openingMessage} />
              )}

              {messages.map((message) => (
                <MessageBubble
                  key={message.id}
                  role={message.role}
                  content={message.content}
                  createdAt={message.createdAt}
                  fileName={message.fileName}
                />
              ))}

              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="border-t border-neutral-200 bg-white px-4 py-4 sm:px-6">
          <div className="mx-auto max-w-4xl">
            {pendingFile && (
              <div className="mb-3 inline-flex max-w-full items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1.5 text-xs text-accent">
                <Paperclip size={14} />
                <span className="truncate">{pendingFile.name}</span>
                <button type="button" onClick={() => setPendingFile(null)} className="rounded-full p-0.5 hover:bg-white/70 hover:text-red-500">
                  <X size={14} />
                </button>
              </div>
            )}

            <div className="rounded-[24px] border border-neutral-200 bg-neutral-50 p-3">
              <div className="flex items-end gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-11 w-11 items-center justify-center rounded-2xl border border-neutral-200 bg-white text-neutral-500 transition-colors hover:border-accent hover:text-accent"
                  title="Datei anhaengen"
                >
                  <Upload size={18} />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,.md,.csv,.xml,.json"
                  className="hidden"
                  onChange={(event) => setPendingFile(event.target.files?.[0] ?? null)}
                />

                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  rows={2}
                  className="min-h-[44px] flex-1 resize-none rounded-2xl border border-transparent bg-white px-4 py-3 text-sm outline-none ring-0 transition-colors focus:border-accent/40"
                  placeholder="Frage stellen oder Dokumentkontext mitschicken..."
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void handleSend();
                    }
                  }}
                />

                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={!input.trim() || isStreaming || isUploadingFile}
                  className="btn-primary h-11 px-4 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function MessageBubble({
  role,
  content,
  createdAt,
  fileName,
}: {
  role: 'user' | 'assistant';
  content: string;
  createdAt?: string;
  fileName?: string;
}) {
  const isUser = role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[88%] sm:max-w-[76%] ${isUser ? 'items-end' : ''}`}>
        {fileName && (
          <div className={`mb-2 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
            isUser ? 'bg-dark text-white' : 'bg-accent/10 text-accent'
          }`}>
            <Paperclip size={14} />
            {fileName}
          </div>
        )}
        <div className={`rounded-[24px] px-5 py-4 text-sm leading-7 shadow-sm ${
          isUser
            ? 'rounded-br-md text-white'
            : 'rounded-bl-md border border-neutral-200 bg-white text-neutral-700'
        }`} style={isUser ? { backgroundColor: 'var(--color-accent)' } : undefined}>
          <div className="whitespace-pre-wrap">{content || '...'}</div>
        </div>
        {createdAt && (
          <div className={`mt-2 px-1 text-[11px] uppercase tracking-[0.16em] text-neutral-400/80 ${isUser ? 'text-right' : ''}`}>
            {new Date(createdAt).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>
    </div>
  );
}

function KnowledgePanel({ assistantId }: { assistantId: string }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const { data: documents, isLoading } = useQuery({
    queryKey: ['ai-knowledge', assistantId],
    queryFn: () => apiGet<KnowledgeDocument[]>(`/ai/assistants/${assistantId}/knowledge`),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fileType = file.name.split('.').pop()?.toLowerCase() ?? 'txt';
      if (!['txt', 'md', 'csv', 'xml', 'json'].includes(fileType)) {
        throw new Error('In dieser ersten Stufe werden Text-, CSV-, XML- und JSON-Dateien unterstuetzt.');
      }

      return apiPost(`/ai/assistants/${assistantId}/knowledge/upload-text`, {
        filename: file.name,
        fileType,
        mimeType: file.type || null,
        fileSize: file.size,
        textContent: await file.text(),
      });
    },
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['ai-knowledge', assistantId] });
    },
    onError: (err: any) => {
      setError(err?.message || 'Dokument konnte nicht hochgeladen werden');
    },
  });

  const includeMutation = useMutation({
    mutationFn: (payload: { id: string; includeInPrompt: boolean }) =>
      apiPatch(`/ai/knowledge/${payload.id}/include`, { includeInPrompt: payload.includeInPrompt }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-knowledge', assistantId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (documentId: string) => apiDelete(`/ai/knowledge/${documentId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-knowledge', assistantId] }),
  });

  return (
    <div className="card space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900">Wissensbasis</h3>
          <p className="text-sm text-neutral-500">
            Hochgeladene Dokumente werden beim Antworten als interner Kontext verwendet.
          </p>
        </div>
        <label className="btn-ghost cursor-pointer">
          <Upload size={16} /> Dokument hochladen
          <input
            type="file"
            accept=".txt,.md,.csv,.xml,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                uploadMutation.mutate(file);
              }
              event.currentTarget.value = '';
            }}
          />
        </label>
      </div>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      {isLoading ? (
        <div className="text-sm text-neutral-500">Dokumente werden geladen...</div>
      ) : !documents?.length ? (
        <div className="rounded-2xl border border-dashed border-neutral-200 px-4 py-5 text-sm text-neutral-500">
          Noch keine Dokumente vorhanden.
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((document) => (
            <div key={document.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-neutral-200 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate font-medium text-neutral-800">{document.filename}</div>
                <div className="text-xs text-neutral-400">
                  {document.fileType.toUpperCase()} · {(document.fileSize / 1024).toFixed(1)} KB
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => includeMutation.mutate({ id: document.id, includeInPrompt: !document.includeInPrompt })}
                  className={`rounded-xl px-3 py-2 text-xs font-medium ${
                    document.includeInPrompt
                      ? 'bg-accent/10 text-accent'
                      : 'bg-neutral-100 text-neutral-600'
                  }`}
                >
                  {document.includeInPrompt ? 'Im Prompt aktiv' : 'Derzeit aus'}
                </button>
                <button
                  onClick={() => deleteMutation.mutate(document.id)}
                  className="rounded-xl px-3 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                >
                  Loeschen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
