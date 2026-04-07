import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiDelete } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import { ROLE_HIERARCHY, type Role } from '@company-hub/shared';
import { Bot, Plus, Send, MessageSquare, Trash2, ArrowLeft, X } from 'lucide-react';

interface Assistant {
  id: string; name: string; slug: string; description: string | null;
  avatarUrl: string | null; model: string; openingMessage: string | null;
}
interface ChatSession { id: string; title: string | null; createdAt: string; updatedAt: string; }
interface Message { id: string; role: string; content: string; createdAt: string; }

export default function AiAssistantsPage() {
  const { user } = useAuthStore();
  const isAdmin = ROLE_HIERARCHY[(user?.role as Role) || 'user'] >= ROLE_HIERARCHY.admin;
  const [activeAssistant, setActiveAssistant] = useState<Assistant | null>(null);
  const [activeSession, setActiveSession] = useState<string | null>(null);

  const { data: assistants } = useQuery({
    queryKey: ['my-assistants'],
    queryFn: () => isAdmin
      ? apiGet<Assistant[]>('/ai/assistants')
      : apiGet<Assistant[]>('/ai/my-assistants'),
  });

  if (activeSession && activeAssistant) {
    return <ChatView assistant={activeAssistant} sessionId={activeSession} onBack={() => setActiveSession(null)} />;
  }

  if (activeAssistant) {
    return <SessionList assistant={activeAssistant} onBack={() => setActiveAssistant(null)} onOpenSession={setActiveSession} />;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-neutral-800">Meine KI-Assistenten</h2>

      {!assistants?.length ? (
        <div className="card p-12 text-center text-neutral-400">
          <Bot size={40} className="mx-auto mb-3 text-neutral-300" />
          <p>Keine KI-Assistenten zugewiesen.</p>
          {isAdmin && <p className="text-sm mt-1">Erstellen Sie Assistenten unter Administration.</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {assistants.map((a) => (
            <button
              key={a.id}
              onClick={() => setActiveAssistant(a)}
              className="card p-5 text-left hover:shadow-elevated transition-shadow"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
                  {a.avatarUrl ? (
                    <img src={a.avatarUrl} className="w-10 h-10 rounded-xl object-cover" />
                  ) : (
                    <Bot size={20} className="text-accent" />
                  )}
                </div>
                <div>
                  <div className="font-medium text-neutral-800">{a.name}</div>
                  <div className="text-xs text-neutral-400">{a.model}</div>
                </div>
              </div>
              {a.description && <p className="text-sm text-neutral-500 line-clamp-2">{a.description}</p>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SessionList({ assistant, onBack, onOpenSession }: {
  assistant: Assistant; onBack: () => void; onOpenSession: (id: string) => void;
}) {
  const queryClient = useQueryClient();

  const { data: sessions } = useQuery({
    queryKey: ['ai-sessions', assistant.id],
    queryFn: () => apiGet<ChatSession[]>(`/ai/chat/sessions?assistantId=${assistant.id}`),
  });

  const createMutation = useMutation({
    mutationFn: () => apiPost('/ai/chat/sessions', { assistantId: assistant.id }),
    onSuccess: (session: any) => {
      queryClient.invalidateQueries({ queryKey: ['ai-sessions'] });
      onOpenSession(session.id);
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="btn-ghost p-2"><ArrowLeft size={18} /></button>
        <h2 className="text-lg font-semibold text-neutral-800">{assistant.name}</h2>
      </div>

      <button onClick={() => createMutation.mutate()} className="btn-primary">
        <Plus size={18} /> Neuer Chat
      </button>

      <div className="space-y-2">
        {!sessions?.length ? (
          <div className="card p-8 text-center text-neutral-400">Noch keine Chats. Starten Sie einen neuen!</div>
        ) : sessions.map((s) => (
          <button key={s.id} onClick={() => onOpenSession(s.id)}
            className="card p-4 w-full text-left hover:bg-neutral-50 flex items-center gap-3">
            <MessageSquare size={18} className="text-neutral-400" />
            <div className="flex-1">
              <div className="font-medium text-neutral-700">{s.title || 'Chat'}</div>
              <div className="text-xs text-neutral-400">{new Date(s.updatedAt).toLocaleString('de-AT')}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ChatView({ assistant, sessionId, onBack }: {
  assistant: Assistant; sessionId: string; onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const [input, setInput] = useState('');

  const { data: messages } = useQuery({
    queryKey: ['ai-messages', sessionId],
    queryFn: () => apiGet<Message[]>(`/ai/chat/sessions/${sessionId}/messages`),
  });

  const sendMutation = useMutation({
    mutationFn: (content: string) => apiPost(`/ai/chat/sessions/${sessionId}/messages`, { content }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-messages', sessionId] });
      setInput('');
    },
  });

  const handleSend = () => {
    if (!input.trim() || sendMutation.isPending) return;
    sendMutation.mutate(input);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-neutral-200">
        <button onClick={onBack} className="btn-ghost p-2"><ArrowLeft size={18} /></button>
        <Bot size={20} className="text-accent" />
        <span className="font-semibold text-neutral-800">{assistant.name}</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {assistant.openingMessage && (!messages || messages.length === 0) && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
              <Bot size={16} className="text-accent" />
            </div>
            <div className="bg-neutral-100 rounded-xl rounded-tl-none px-4 py-2.5 max-w-[70%]">
              <p className="text-sm text-neutral-700">{assistant.openingMessage}</p>
            </div>
          </div>
        )}

        {messages?.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
            {msg.role !== 'user' && (
              <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                <Bot size={16} className="text-accent" />
              </div>
            )}
            <div className={`rounded-xl px-4 py-2.5 max-w-[70%] ${
              msg.role === 'user'
                ? 'text-white rounded-tr-none'
                : 'bg-neutral-100 text-neutral-700 rounded-tl-none'
            }`} style={msg.role === 'user' ? { backgroundColor: 'var(--color-accent)' } : undefined}>
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        {sendMutation.isPending && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
              <Bot size={16} className="text-accent" />
            </div>
            <div className="bg-neutral-100 rounded-xl rounded-tl-none px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-neutral-200 pt-4">
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="Nachricht eingeben..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          />
          <button onClick={handleSend} disabled={!input.trim() || sendMutation.isPending} className="btn-primary px-4">
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
