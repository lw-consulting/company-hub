import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import { ROLE_HIERARCHY, type Role } from '@company-hub/shared';
import {
  ArrowLeft,
  Bot,
  FileText,
  KeyRound,
  MessageSquare,
  Paperclip,
  Pencil,
  Plus,
  Send,
  Settings2,
  Trash2,
  Upload,
  UserCog,
  Users,
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
  responseStructure?: string | null;
  isActive?: boolean;
}

interface AssistantDetail extends Assistant {
  providerId: string;
  systemPrompt: string | null;
  temperature: string | number | null;
  maxTokens: number | null;
  topP: string | number | null;
  tone: string | null;
  language: string | null;
  forbiddenTopics: string[] | null;
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

interface Provider {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  createdAt?: string;
}

interface UserRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  department: string | null;
  isActive: boolean;
}

const PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'gemini', label: 'Google Gemini' },
];

const MODEL_OPTIONS: Record<string, string[]> = {
  openai: ['gpt-4.1-mini', 'gpt-4.1', 'gpt-4o-mini'],
  anthropic: ['claude-sonnet-4-5', 'claude-haiku-4-5'],
  gemini: ['gemini-2.0-flash', 'gemini-2.5-flash'],
};

export default function AiAssistantsPage() {
  const { user } = useAuthStore();
  const isAdmin = ROLE_HIERARCHY[(user?.role as Role) || 'user'] >= ROLE_HIERARCHY.admin;
  const [mode, setMode] = useState<'chat' | 'admin'>(isAdmin ? 'admin' : 'chat');
  const [activeAssistant, setActiveAssistant] = useState<Assistant | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin && mode === 'admin') {
      setMode('chat');
    }
  }, [isAdmin, mode]);

  if (mode === 'admin' && isAdmin) {
    return <AiAdminPanel onOpenAssistant={(assistant) => {
      setActiveAssistant(assistant);
      setActiveSessionId(NEW_CHAT_ID);
      setMode('chat');
    }} />;
  }

  return (
    <AiChatPanel
      isAdmin={isAdmin}
      activeAssistant={activeAssistant}
      activeSessionId={activeSessionId}
      onSelectAssistant={setActiveAssistant}
      onSessionIdChange={setActiveSessionId}
      onOpenAdmin={() => setMode('admin')}
      onResetSelection={() => {
        setActiveAssistant(null);
        setActiveSessionId(null);
      }}
    />
  );
}

function AiChatPanel({
  isAdmin,
  activeAssistant,
  activeSessionId,
  onSelectAssistant,
  onSessionIdChange,
  onOpenAdmin,
  onResetSelection,
}: {
  isAdmin: boolean;
  activeAssistant: Assistant | null;
  activeSessionId: string | null;
  onSelectAssistant: (assistant: Assistant | null) => void;
  onSessionIdChange: (sessionId: string | null) => void;
  onOpenAdmin: () => void;
  onResetSelection: () => void;
}) {
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
        onBack={() => onSessionIdChange(null)}
        onSessionIdChange={onSessionIdChange}
      />
    );
  }

  if (activeAssistant) {
    return (
      <SessionList
        assistant={activeAssistant}
        isAdmin={isAdmin}
        onBack={() => onSelectAssistant(null)}
        onOpenSession={(sessionId) => onSessionIdChange(sessionId)}
      />
    );
  }

  if (isLoading) {
    return <div className="card p-8 text-sm text-neutral-500">Assistenten werden geladen...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">KI-Assistenten</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Interne Assistenten mit Verlauf, Streaming und optionalem Dokumentkontext.
          </p>
        </div>
        {isAdmin && (
          <button onClick={onOpenAdmin} className="btn-ghost">
            <Settings2 size={16} /> Verwaltung öffnen
          </button>
        )}
      </div>

      {!assistants?.length ? (
        <div className="card p-12 text-center text-neutral-400">
          <Bot size={40} className="mx-auto mb-3 text-neutral-300" />
          <p>Keine KI-Assistenten verfuegbar.</p>
          {isAdmin && (
            <div className="mt-4 flex justify-center">
              <button onClick={onOpenAdmin} className="btn-primary">
                <Settings2 size={16} /> Verwaltung öffnen
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {assistants.map((assistant) => (
            <button
              key={assistant.id}
              onClick={() => onSelectAssistant(assistant)}
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

function AiAdminPanel({ onOpenAssistant }: { onOpenAssistant: (assistant: Assistant) => void }) {
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<'providers' | 'assistants' | 'assignments'>('providers');
  const [editingAssistantId, setEditingAssistantId] = useState<string | null>(null);

  const { data: providers } = useQuery({
    queryKey: ['ai-admin-providers'],
    queryFn: () => apiGet<Provider[]>('/ai/providers'),
  });

  const { data: assistants } = useQuery({
    queryKey: ['ai-admin-assistants'],
    queryFn: () => apiGet<Assistant[]>('/ai/assistants'),
  });

  const providerDeleteMutation = useMutation({
    mutationFn: (providerId: string) => apiDelete(`/ai/providers/${providerId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-admin-providers'] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">KI-Assistenten verwalten</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Provider anlegen, Assistenten konfigurieren, Benutzer zuweisen und Wissensbasis pflegen.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveSection('providers')}
          className={`rounded-2xl px-4 py-2 text-sm font-medium ${activeSection === 'providers' ? 'bg-dark text-white' : 'bg-white text-neutral-600 border border-neutral-200'}`}
        >
          <KeyRound size={16} className="mr-2 inline" /> Provider
        </button>
        <button
          onClick={() => setActiveSection('assistants')}
          className={`rounded-2xl px-4 py-2 text-sm font-medium ${activeSection === 'assistants' ? 'bg-dark text-white' : 'bg-white text-neutral-600 border border-neutral-200'}`}
        >
          <Bot size={16} className="mr-2 inline" /> Assistenten
        </button>
        <button
          onClick={() => setActiveSection('assignments')}
          className={`rounded-2xl px-4 py-2 text-sm font-medium ${activeSection === 'assignments' ? 'bg-dark text-white' : 'bg-white text-neutral-600 border border-neutral-200'}`}
        >
          <Users size={16} className="mr-2 inline" /> Zuweisungen
        </button>
      </div>

      {activeSection === 'providers' && (
        <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
          <ProviderForm />
          <div className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-neutral-900">Vorhandene Provider</h3>
            </div>
            {!providers?.length ? (
              <div className="rounded-2xl border border-dashed border-neutral-200 px-4 py-5 text-sm text-neutral-500">
                Noch keine Provider vorhanden.
              </div>
            ) : (
              <div className="space-y-3">
                {providers.map((provider) => (
                  <div key={provider.id} className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-200 px-4 py-3">
                    <div>
                      <div className="font-medium text-neutral-800">{provider.name}</div>
                      <div className="text-xs uppercase tracking-[0.12em] text-neutral-400">{provider.type}</div>
                    </div>
                    <button
                      onClick={() => providerDeleteMutation.mutate(provider.id)}
                      className="rounded-xl p-2 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeSection === 'assistants' && (
        <div className="grid gap-5 xl:grid-cols-[430px_minmax(0,1fr)]">
          <AssistantForm
            providers={providers || []}
            assistantId={editingAssistantId}
            onSaved={() => {
              queryClient.invalidateQueries({ queryKey: ['ai-admin-assistants'] });
              setEditingAssistantId(null);
            }}
          />
          <div className="space-y-5">
            <div className="card p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-neutral-900">Assistenten</h3>
              </div>
              {!assistants?.length ? (
                <div className="rounded-2xl border border-dashed border-neutral-200 px-4 py-5 text-sm text-neutral-500">
                  Noch keine Assistenten vorhanden.
                </div>
              ) : (
                <div className="space-y-3">
                  {assistants.map((assistant) => (
                    <div key={assistant.id} className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-200 px-4 py-3">
                      <button onClick={() => onOpenAssistant(assistant)} className="min-w-0 flex-1 text-left">
                        <div className="truncate font-medium text-neutral-800">{assistant.name}</div>
                        <div className="truncate text-xs text-neutral-400">{assistant.model}</div>
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditingAssistantId(assistant.id)}
                          className="rounded-xl p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
                        >
                          <Pencil size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {editingAssistantId && (
              <KnowledgePanel assistantId={editingAssistantId} />
            )}
          </div>
        </div>
      )}

      {activeSection === 'assignments' && (
        <AssignmentPanel assistants={assistants || []} />
      )}
    </div>
  );
}

function ProviderForm() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', type: 'openai', apiKey: '' });
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => apiPost('/ai/providers', form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-admin-providers'] });
      setForm({ name: '', type: 'openai', apiKey: '' });
      setError('');
    },
    onError: (err: any) => setError(err?.message || 'Provider konnte nicht angelegt werden'),
  });

  return (
    <div className="card p-5">
      <h3 className="mb-4 text-lg font-semibold text-neutral-900">Neuen Provider anlegen</h3>
      <div className="space-y-4">
        <div>
          <label className="label">Name</label>
          <input
            className="input"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="OpenAI Produktion"
          />
        </div>
        <div>
          <label className="label">Typ</label>
          <select
            className="input"
            value={form.type}
            onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
          >
            {PROVIDER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">API-Key</label>
          <input
            className="input"
            type="password"
            value={form.apiKey}
            onChange={(event) => setForm((current) => ({ ...current, apiKey: event.target.value }))}
            placeholder="sk-..."
          />
        </div>
        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
        <button
          onClick={() => mutation.mutate()}
          disabled={!form.name.trim() || !form.apiKey.trim() || mutation.isPending}
          className="btn-primary"
        >
          <Plus size={16} /> Provider speichern
        </button>
      </div>
    </div>
  );
}

function AssistantForm({
  providers,
  assistantId,
  onSaved,
}: {
  providers: Provider[];
  assistantId: string | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    providerId: '',
    name: '',
    description: '',
    model: '',
    systemPrompt: '',
    openingMessage: '',
    responseStructure: '',
    temperature: '0.7',
    topP: '1',
    maxTokens: '2048',
    tone: 'professional',
    language: 'de',
    forbiddenTopics: '',
    isActive: true,
  });
  const [error, setError] = useState('');

  const { data: assistantDetail } = useQuery({
    queryKey: ['ai-admin-assistant', assistantId],
    queryFn: () => assistantId ? apiGet<AssistantDetail>(`/ai/assistants/${assistantId}`) : Promise.resolve(null),
    enabled: Boolean(assistantId),
  });

  useEffect(() => {
    if (!assistantDetail) {
      return;
    }

    setForm({
      providerId: assistantDetail.providerId,
      name: assistantDetail.name,
      description: assistantDetail.description || '',
      model: assistantDetail.model,
      systemPrompt: assistantDetail.systemPrompt || '',
      openingMessage: assistantDetail.openingMessage || '',
      responseStructure: assistantDetail.responseStructure || '',
      temperature: String(assistantDetail.temperature ?? '0.7'),
      topP: String(assistantDetail.topP ?? '1'),
      maxTokens: String(assistantDetail.maxTokens ?? '2048'),
      tone: assistantDetail.tone || 'professional',
      language: assistantDetail.language || 'de',
      forbiddenTopics: (assistantDetail.forbiddenTopics || []).join('\n'),
      isActive: assistantDetail.isActive ?? true,
    });
  }, [assistantDetail]);

  useEffect(() => {
    if (!assistantId) {
      setForm({
        providerId: providers[0]?.id || '',
        name: '',
        description: '',
        model: providers[0] ? MODEL_OPTIONS[providers[0].type]?.[0] || '' : '',
        systemPrompt: '',
        openingMessage: '',
        responseStructure: '',
        temperature: '0.7',
        topP: '1',
        maxTokens: '2048',
        tone: 'professional',
        language: 'de',
        forbiddenTopics: '',
        isActive: true,
      });
    }
  }, [assistantId, providers]);

  const selectedProvider = useMemo(
    () => providers.find((provider) => provider.id === form.providerId) || null,
    [providers, form.providerId],
  );

  const mutation = useMutation({
    mutationFn: () => {
      const payload = {
        providerId: form.providerId,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        model: form.model,
        systemPrompt: form.systemPrompt.trim() || undefined,
        openingMessage: form.openingMessage.trim() || undefined,
        responseStructure: form.responseStructure.trim() || undefined,
        temperature: Number(form.temperature),
        topP: Number(form.topP),
        maxTokens: Number(form.maxTokens),
        tone: form.tone,
        language: form.language,
        forbiddenTopics: form.forbiddenTopics.split('\n').map((line) => line.trim()).filter(Boolean),
        isActive: form.isActive,
      };

      return assistantId
        ? apiPatch(`/ai/assistants/${assistantId}`, payload)
        : apiPost('/ai/assistants', payload);
    },
    onSuccess: () => {
      setError('');
      onSaved();
    },
    onError: (err: any) => setError(err?.message || 'Assistent konnte nicht gespeichert werden'),
  });

  return (
    <div className="card p-5">
      <h3 className="mb-4 text-lg font-semibold text-neutral-900">
        {assistantId ? 'Assistent bearbeiten' : 'Neuen Assistenten anlegen'}
      </h3>
      <div className="space-y-4">
        <div>
          <label className="label">Provider</label>
          <select
            className="input"
            value={form.providerId}
            onChange={(event) => {
              const providerId = event.target.value;
              const provider = providers.find((entry) => entry.id === providerId);
              setForm((current) => ({
                ...current,
                providerId,
                model: provider ? (MODEL_OPTIONS[provider.type]?.[0] || '') : '',
              }));
            }}
          >
            <option value="">Provider wählen</option>
            {providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name} ({provider.type})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Name</label>
          <input
            className="input"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="HR Assistent"
          />
        </div>

        <div>
          <label className="label">Beschreibung</label>
          <textarea
            className="input min-h-[88px]"
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            placeholder="Hilft bei internen Richtlinien und Prozessen."
          />
        </div>

        <div>
          <label className="label">Modell</label>
          <select
            className="input"
            value={form.model}
            onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))}
          >
            <option value="">Modell wählen</option>
            {(selectedProvider ? MODEL_OPTIONS[selectedProvider.type] || [] : []).map((model) => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Temperature</label>
            <input className="input" value={form.temperature} onChange={(event) => setForm((current) => ({ ...current, temperature: event.target.value }))} />
          </div>
          <div>
            <label className="label">Top P</label>
            <input className="input" value={form.topP} onChange={(event) => setForm((current) => ({ ...current, topP: event.target.value }))} />
          </div>
          <div>
            <label className="label">Max Tokens</label>
            <input className="input" value={form.maxTokens} onChange={(event) => setForm((current) => ({ ...current, maxTokens: event.target.value }))} />
          </div>
        </div>

        <div>
          <label className="label">System Prompt</label>
          <textarea
            className="input min-h-[160px] font-mono text-sm"
            value={form.systemPrompt}
            onChange={(event) => setForm((current) => ({ ...current, systemPrompt: event.target.value }))}
            placeholder="Du bist ein interner Assistent für ..."
          />
        </div>

        <div>
          <label className="label">Opening Message</label>
          <textarea
            className="input min-h-[88px]"
            value={form.openingMessage}
            onChange={(event) => setForm((current) => ({ ...current, openingMessage: event.target.value }))}
          />
        </div>

        <div>
          <label className="label">Antwort-Struktur</label>
          <textarea
            className="input min-h-[88px]"
            value={form.responseStructure}
            onChange={(event) => setForm((current) => ({ ...current, responseStructure: event.target.value }))}
            placeholder="1. Kurzantwort&#10;2. Nächste Schritte"
          />
        </div>

        <div>
          <label className="label">Verbotene Themen</label>
          <textarea
            className="input min-h-[88px]"
            value={form.forbiddenTopics}
            onChange={(event) => setForm((current) => ({ ...current, forbiddenTopics: event.target.value }))}
            placeholder="Eine Zeile pro Thema"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Ton</label>
            <select className="input" value={form.tone} onChange={(event) => setForm((current) => ({ ...current, tone: event.target.value }))}>
              <option value="professional">Professional</option>
              <option value="friendly">Friendly</option>
              <option value="formal">Formal</option>
              <option value="casual">Casual</option>
            </select>
          </div>
          <div>
            <label className="label">Sprache</label>
            <select className="input" value={form.language} onChange={(event) => setForm((current) => ({ ...current, language: event.target.value }))}>
              <option value="de">Deutsch</option>
              <option value="en">Englisch</option>
              <option value="both">Beides</option>
            </select>
          </div>
        </div>

        <label className="flex items-center gap-3 rounded-2xl border border-neutral-200 px-4 py-3 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
          />
          Assistent ist aktiv
        </label>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

        <button
          onClick={() => mutation.mutate()}
          disabled={!form.providerId || !form.name.trim() || !form.model || mutation.isPending}
          className="btn-primary"
        >
          <Bot size={16} /> {assistantId ? 'Änderungen speichern' : 'Assistent anlegen'}
        </button>
      </div>
    </div>
  );
}

function AssignmentPanel({ assistants }: { assistants: Assistant[] }) {
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [assignedAssistantIds, setAssignedAssistantIds] = useState<string[]>([]);

  const { data: usersResponse } = useQuery({
    queryKey: ['ai-admin-users'],
    queryFn: () => apiGet<{ data: UserRow[]; total: number }>('/users?pageSize=100'),
  });

  const users = usersResponse?.data || [];

  const { data: assignedAssistants } = useQuery({
    queryKey: ['ai-user-assistants', selectedUserId],
    queryFn: () => selectedUserId ? apiGet<Array<{ id: string; name: string }>>(`/ai/users/${selectedUserId}/assistants`) : Promise.resolve([]),
    enabled: Boolean(selectedUserId),
  });

  useEffect(() => {
    setAssignedAssistantIds((assignedAssistants || []).map((assistant) => assistant.id));
  }, [assignedAssistants]);

  const mutation = useMutation({
    mutationFn: () => apiPut(`/ai/users/${selectedUserId}/assistants`, { assistantIds: assignedAssistantIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-user-assistants', selectedUserId] });
    },
  });

  return (
    <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
      <div className="card p-5">
        <h3 className="mb-4 text-lg font-semibold text-neutral-900">Benutzer auswählen</h3>
        <div className="space-y-2">
          {users.map((user) => (
            <button
              key={user.id}
              onClick={() => setSelectedUserId(user.id)}
              className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition-colors ${
                selectedUserId === user.id ? 'bg-dark text-white' : 'bg-neutral-50 text-neutral-700 hover:bg-neutral-100'
              }`}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-xs font-semibold">
                {user.firstName[0]}{user.lastName[0]}
              </div>
              <div className="min-w-0">
                <div className="truncate font-medium">{user.firstName} {user.lastName}</div>
                <div className={`truncate text-xs ${selectedUserId === user.id ? 'text-white/70' : 'text-neutral-400'}`}>{user.email}</div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-neutral-900">Assistenten zuweisen</h3>
          <button
            onClick={() => mutation.mutate()}
            disabled={!selectedUserId || mutation.isPending}
            className="btn-primary"
          >
            <UserCog size={16} /> Zuweisungen speichern
          </button>
        </div>

        {!selectedUserId ? (
          <div className="rounded-2xl border border-dashed border-neutral-200 px-4 py-5 text-sm text-neutral-500">
            Wähle links zuerst einen Benutzer aus.
          </div>
        ) : !assistants.length ? (
          <div className="rounded-2xl border border-dashed border-neutral-200 px-4 py-5 text-sm text-neutral-500">
            Noch keine Assistenten vorhanden.
          </div>
        ) : (
          <div className="space-y-3">
            {assistants.map((assistant) => {
              const checked = assignedAssistantIds.includes(assistant.id);
              return (
                <label key={assistant.id} className="flex items-start gap-3 rounded-2xl border border-neutral-200 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      setAssignedAssistantIds((current) =>
                        event.target.checked
                          ? [...current, assistant.id]
                          : current.filter((id) => id !== assistant.id),
                      );
                    }}
                  />
                  <div className="min-w-0">
                    <div className="font-medium text-neutral-800">{assistant.name}</div>
                    <div className="text-sm text-neutral-500">{assistant.description || assistant.model}</div>
                  </div>
                </label>
              );
            })}
          </div>
        )}
      </div>
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
                title="Chat löschen"
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
            <ArrowLeft size={16} /> Zurück zur Verlaufsliste
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
            <Trash2 size={16} /> Aktuellen Chat löschen
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
              {pendingFile ? 'Datei angehängt' : 'Streaming aktiv bei jeder Antwort'}
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
                  title="Datei anhängen"
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
        throw new Error('In dieser ersten Stufe werden Text-, CSV-, XML- und JSON-Dateien unterstützt.');
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
                  Löschen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
