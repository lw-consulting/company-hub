import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, MessageSquarePlus, Paperclip, Search, Send, Users, X } from 'lucide-react';
import { apiGet, apiPatch, apiPost, ensureAccessToken, resolveImageUrl } from '../../lib/api';

const API_BASE = (import.meta as any).env?.VITE_API_URL || '/api';

interface ChatUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
  department: string | null;
  position: string | null;
}

interface ChatAttachment {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
}

interface ChatMessage {
  id: string;
  conversationId: string;
  content: string;
  messageType: string;
  createdAt: string;
  editedAt: string | null;
  sender: ChatUser;
  attachments: ChatAttachment[];
  receiptSummary: ChatReceiptSummary;
}

interface ChatReceiptSummary {
  recipientCount: number;
  deliveredCount: number;
  readCount: number;
  status: 'sent' | 'delivered' | 'read';
}

interface ChatConversation {
  id: string;
  type: 'direct' | 'group';
  title: string;
  participants: ChatUser[];
  lastMessage: ChatMessage | null;
  unreadCount: number;
  isMuted: boolean;
  role: string;
  updatedAt: string;
  lastMessageAt: string;
}

type ComposerState = 'idle' | 'sending';

function formatRelative(date: string) {
  return new Intl.DateTimeFormat('de-AT', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(date));
}

function Avatar({ user, size = 10 }: { user: Pick<ChatUser, 'firstName' | 'lastName' | 'avatarUrl'>; size?: number }) {
  const pixelSize = size * 4;
  return (
    <div
      className="shrink-0 overflow-hidden rounded-2xl bg-neutral-200 text-neutral-700 flex items-center justify-center font-semibold"
      style={{ width: pixelSize, height: pixelSize }}
    >
      {user.avatarUrl ? (
        <img
          src={resolveImageUrl(user.avatarUrl)}
          alt=""
          className="object-cover"
          style={{ width: pixelSize, height: pixelSize }}
        />
      ) : (
        <span>{user.firstName[0]}{user.lastName[0]}</span>
      )}
    </div>
  );
}

export default function ChatPage() {
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [composerText, setComposerText] = useState('');
  const [composerState, setComposerState] = useState<ComposerState>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [groupMode, setGroupMode] = useState(false);
  const [groupTitle, setGroupTitle] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const selectedConversationIdRef = useRef<string | null>(null);
  const ownUserId = useMemo(() => getOwnUserId(), []);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId]
  );

  const filteredConversations = useMemo(() => {
    if (!search.trim()) {
      return conversations;
    }
    const needle = search.trim().toLowerCase();
    return conversations.filter((conversation) => (
      conversation.title.toLowerCase().includes(needle) ||
      conversation.participants.some((participant) =>
        `${participant.firstName} ${participant.lastName}`.toLowerCase().includes(needle)
      )
    ));
  }, [conversations, search]);

  const availableUsers = useMemo(() => {
    if (!search.trim()) {
      return users;
    }
    const needle = search.trim().toLowerCase();
    return users.filter((user) => (
      `${user.firstName} ${user.lastName}`.toLowerCase().includes(needle) ||
      user.email.toLowerCase().includes(needle)
    ));
  }, [users, search]);

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  useEffect(() => {
    void loadInitialData();
  }, []);

  useEffect(() => {
    if (showNewChat && users.length === 0) {
      void loadAvailableUsers();
    }
  }, [showNewChat, users.length]);

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      return;
    }
    void loadMessages(selectedConversationId);
  }, [selectedConversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    let cancelled = false;
    let controller: AbortController | null = null;

    async function connect() {
      const token = await ensureAccessToken();
      if (!token || cancelled) {
        return;
      }

      controller = new AbortController();
      const response = await fetch(`${API_BASE}/chat/events/stream`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (!cancelled) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() ?? '';

        for (const chunk of chunks) {
          const line = chunk.split('\n').find((entry) => entry.startsWith('data: '));
          if (!line) {
            continue;
          }

          const payload = JSON.parse(line.slice(6)) as
            | { type: 'message.created'; conversationId: string; message: ChatMessage }
            | { type: 'conversation.read'; conversationId: string; userId: string; readAt: string }
            | { type: 'message.receipts'; conversationId: string; messageId: string; receiptSummary: ChatReceiptSummary }
            | { type: 'conversation.updated'; conversationId: string; title: string };

          if (payload.type === 'message.created') {
            setConversations((current) => {
              const next = current.map((conversation) => (
                conversation.id === payload.conversationId
                  ? {
                      ...conversation,
                      lastMessage: payload.message,
                      unreadCount:
                        selectedConversationIdRef.current === payload.conversationId
                          ? 0
                          : conversation.unreadCount + (payload.message.sender.id === ownUserId ? 0 : 1),
                      lastMessageAt: payload.message.createdAt,
                    }
                  : conversation
              ));
              return sortConversations(next);
            });

            if (payload.conversationId === selectedConversationIdRef.current) {
              setMessages((current) => (
                current.some((message) => message.id === payload.message.id)
                  ? current
                  : [...current, payload.message]
              ));
            }
          }

          if (payload.type === 'message.receipts') {
            if (payload.conversationId === selectedConversationIdRef.current) {
              setMessages((current) => current.map((message) => (
                message.id === payload.messageId
                  ? { ...message, receiptSummary: payload.receiptSummary }
                  : message
              )));
            }

            setConversations((current) => current.map((conversation) => (
              conversation.id === payload.conversationId && conversation.lastMessage?.id === payload.messageId
                ? {
                    ...conversation,
                    lastMessage: {
                      ...conversation.lastMessage,
                      receiptSummary: payload.receiptSummary,
                    },
                  }
                : conversation
            )));
          }

          if (payload.type === 'conversation.updated') {
            setConversations((current) => current.map((conversation) => (
              conversation.id === payload.conversationId
                ? { ...conversation, title: payload.title }
                : conversation
            )));
          }
        }
      }
    }

    void connect();
    return () => {
      cancelled = true;
      controller?.abort();
    };
  }, [ownUserId]);

  async function loadInitialData() {
    setLoading(true);
    setError(null);
    try {
      const conversationData = await apiGet<ChatConversation[]>('/chat/conversations');
      const ordered = sortConversations(conversationData);
      setConversations(ordered);
      setSelectedConversationId((current) => current ?? ordered[0]?.id ?? null);
    } catch (err: any) {
      setError(err?.message || 'Chats konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }

  async function loadAvailableUsers() {
    try {
      const userData = await apiGet<ChatUser[]>('/chat/users');
      setUsers(userData);
    } catch (err: any) {
      setError(err?.message || 'Benutzer konnten nicht geladen werden');
    }
  }

  async function loadMessages(conversationId: string) {
    setMessagesLoading(true);
    try {
      const data = await apiGet<ChatMessage[]>(`/chat/conversations/${conversationId}/messages`);
      setMessages(data);
      setConversations((current) => current.map((conversation) => (
        conversation.id === conversationId
          ? { ...conversation, unreadCount: 0 }
          : conversation
      )));
    } catch (err: any) {
      setError(err?.message || 'Nachrichten konnten nicht geladen werden');
    } finally {
      setMessagesLoading(false);
    }
  }

  async function createDirectConversation(userId: string) {
    const result = await apiPost<{ id: string }>('/chat/conversations/direct', { userId });
    const existing = conversations.find((conversation) => conversation.id === result.id);
    if (!existing) {
      await loadInitialData();
    }
    setSelectedConversationId(result.id);
    setShowNewChat(false);
    setGroupMode(false);
    setGroupTitle('');
    setSelectedUserIds([]);
  }

  async function createGroupConversation() {
    const result = await apiPost<{ id: string }>('/chat/conversations/group', {
      title: groupTitle,
      participantIds: selectedUserIds,
    });
    await loadInitialData();
    setSelectedConversationId(result.id);
    setShowNewChat(false);
    setGroupMode(false);
    setGroupTitle('');
    setSelectedUserIds([]);
  }

  async function sendCurrentMessage() {
    if (!selectedConversationId || composerState === 'sending') {
      return;
    }

    if (!composerText.trim() && !selectedFile) {
      return;
    }

    setComposerState('sending');
    setError(null);
    const tempId = `temp-${crypto.randomUUID()}`;
    const optimisticMessage: ChatMessage = {
      id: tempId,
      conversationId: selectedConversationId,
      content: composerText.trim(),
      messageType: selectedFile ? 'attachment' : 'text',
      createdAt: new Date().toISOString(),
      editedAt: null,
      sender: {
        id: ownUserId,
        firstName: '',
        lastName: '',
        email: '',
        avatarUrl: null,
        department: null,
        position: null,
      },
      attachments: selectedFile
        ? [{
            id: `temp-attachment-${tempId}`,
            filename: selectedFile.name,
            mimeType: selectedFile.type || 'application/octet-stream',
            sizeBytes: selectedFile.size,
            url: '',
          }]
        : [],
      receiptSummary: {
        recipientCount: Math.max((selectedConversation?.participants.length ?? 1) - 1, 0),
        deliveredCount: 0,
        readCount: 0,
        status: 'sent',
      },
    };

    setMessages((current) => [...current, optimisticMessage]);
    setConversations((current) => sortConversations(current.map((conversation) => (
      conversation.id === selectedConversationId
        ? {
            ...conversation,
            lastMessage: optimisticMessage,
            lastMessageAt: optimisticMessage.createdAt,
            unreadCount: 0,
          }
        : conversation
    ))));
    setComposerText('');
    setSelectedFile(null);

    try {
      let message: ChatMessage;
      const fileToUpload = selectedFile;
      const contentToSend = composerText.trim();
      if (selectedFile) {
        const token = await ensureAccessToken();
        if (!token) {
          throw new Error('Session abgelaufen');
        }
        const formData = new FormData();
        formData.append('file', fileToUpload!);
        formData.append('content', contentToSend);
        const response = await fetch(`${API_BASE}/chat/conversations/${selectedConversationId}/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.message || 'Anhang konnte nicht gesendet werden');
        }
        message = payload.data as ChatMessage;
      } else {
        message = await apiPost<ChatMessage>(`/chat/conversations/${selectedConversationId}/messages`, {
          content: contentToSend,
        });
      }

      setMessages((current) => current.map((entry) => (
        entry.id === tempId ? message : entry
      )));
      setConversations((current) => sortConversations(current.map((conversation) => (
        conversation.id === selectedConversationId
          ? {
              ...conversation,
              lastMessage: message,
              lastMessageAt: message.createdAt,
              unreadCount: 0,
            }
          : conversation
      ))));
    } catch (err: any) {
      setMessages((current) => current.filter((entry) => entry.id !== tempId));
      setError(err?.message || 'Nachricht konnte nicht gesendet werden');
    } finally {
      setComposerState('idle');
    }
  }

  const canRenameGroup = selectedConversation?.type === 'group' && selectedConversation.role === 'admin';

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
      <aside className="rounded-3xl border border-neutral-200 bg-white overflow-hidden">
        <div className="border-b border-neutral-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-neutral-900">Chats</h2>
              <p className="text-sm text-neutral-500">Private Gespräche und Team-Unterhaltungen in Echtzeit.</p>
            </div>
            <button
              onClick={() => setShowNewChat((current) => !current)}
              className="inline-flex items-center gap-2 rounded-2xl bg-neutral-900 px-3 py-2 text-sm font-medium text-white"
            >
              <MessageSquarePlus size={16} />
              Neu
            </button>
          </div>

          <label className="mt-4 flex items-center gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 px-3 py-2">
            <Search size={16} className="text-neutral-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Chats oder Kollegen suchen"
              className="w-full bg-transparent text-sm outline-none"
            />
          </label>
        </div>

        {showNewChat && (
          <div className="border-b border-neutral-200 bg-neutral-50 p-4">
            <div className="flex gap-2">
              <button
                onClick={() => setGroupMode(false)}
                className={`rounded-full px-3 py-1.5 text-sm ${!groupMode ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-600'}`}
              >
                Direkt
              </button>
              <button
                onClick={() => setGroupMode(true)}
                className={`rounded-full px-3 py-1.5 text-sm ${groupMode ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-600'}`}
              >
                Gruppe
              </button>
            </div>

            {groupMode && (
              <input
                value={groupTitle}
                onChange={(event) => setGroupTitle(event.target.value)}
                placeholder="Gruppenname"
                className="mt-3 w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-sm outline-none"
              />
            )}

            <div className="mt-3 max-h-56 space-y-2 overflow-auto">
              {availableUsers.map((user) => {
                const selected = selectedUserIds.includes(user.id);
                return (
                  <button
                    key={user.id}
                    onClick={() => {
                      if (!groupMode) {
                        void createDirectConversation(user.id);
                        return;
                      }
                      setSelectedUserIds((current) => (
                        selected ? current.filter((id) => id !== user.id) : [...current, user.id]
                      ));
                    }}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left ${
                      selected ? 'bg-neutral-900 text-white' : 'bg-white text-neutral-800'
                    }`}
                  >
                    <Avatar user={user} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{user.firstName} {user.lastName}</div>
                      <div className={`truncate text-xs ${selected ? 'text-neutral-300' : 'text-neutral-500'}`}>{user.email}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {groupMode && (
              <button
                onClick={() => void createGroupConversation()}
                disabled={!groupTitle.trim() || selectedUserIds.length === 0}
                className="mt-3 w-full rounded-2xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-neutral-300"
              >
                Gruppenchat erstellen
              </button>
            )}
          </div>
        )}

        <div className="max-h-[70vh] overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center p-8 text-neutral-500">
              <Loader2 className="animate-spin" />
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-6 text-sm text-neutral-500">Noch keine Unterhaltungen vorhanden.</div>
          ) : (
            filteredConversations.map((conversation) => (
              <button
                key={conversation.id}
                onClick={() => setSelectedConversationId(conversation.id)}
                className={`flex w-full items-start gap-3 border-b border-neutral-100 px-4 py-4 text-left ${
                  conversation.id === selectedConversationId ? 'bg-neutral-50' : 'bg-white'
                }`}
              >
                {conversation.type === 'group' ? (
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-neutral-900 text-white">
                    <Users size={18} />
                  </div>
                ) : (
                  <Avatar user={conversation.participants.find((participant) => participant.id !== ownUserId) ?? conversation.participants[0]} />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="truncate text-sm font-semibold text-neutral-900">{conversation.title}</div>
                    <span className="shrink-0 text-xs text-neutral-400">
                      {conversation.lastMessageAt ? formatRelative(conversation.lastMessageAt) : ''}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-sm text-neutral-500">
                    {conversation.lastMessage?.content || (conversation.lastMessage?.attachments.length ? 'Anhang' : 'Noch keine Nachrichten')}
                  </div>
                </div>
                {conversation.unreadCount > 0 && (
                  <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--color-accent)] px-2 text-xs font-semibold text-white">
                    {conversation.unreadCount}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="flex min-h-[72vh] flex-col rounded-3xl border border-neutral-200 bg-white">
        {!selectedConversation ? (
          <div className="flex flex-1 items-center justify-center p-10 text-center text-neutral-500">
            Unterhaltung auswählen oder einen neuen Chat starten.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
              <div>
                <div className="text-lg font-semibold text-neutral-900">{selectedConversation.title}</div>
                <div className="text-sm text-neutral-500">
                  {selectedConversation.participants.map((participant) => `${participant.firstName} ${participant.lastName}`).join(', ')}
                </div>
              </div>

              {canRenameGroup && (
                <button
                  onClick={async () => {
                    const nextTitle = window.prompt('Neuer Gruppenname', selectedConversation.title);
                    if (!nextTitle || nextTitle === selectedConversation.title) {
                      return;
                    }
                    await apiPatch(`/chat/conversations/${selectedConversation.id}`, { title: nextTitle });
                    setConversations((current) => current.map((conversation) => (
                      conversation.id === selectedConversation.id
                        ? { ...conversation, title: nextTitle }
                        : conversation
                    )));
                  }}
                  className="rounded-2xl border border-neutral-200 px-3 py-2 text-sm font-medium text-neutral-700"
                >
                  Gruppe umbenennen
                </button>
              )}
            </div>

            <div className="flex-1 space-y-4 overflow-auto px-6 py-5">
              {messagesLoading ? (
                <div className="flex items-center justify-center py-12 text-neutral-500">
                  <Loader2 className="animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="py-12 text-center text-neutral-500">Noch keine Nachrichten in dieser Unterhaltung.</div>
              ) : (
                messages.map((message) => {
                  const isOwn = message.sender.id === ownUserId;
                  return (
                    <div key={message.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-3xl px-4 py-3 ${isOwn ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-900'}`}>
                        {!isOwn && (
                          <div className="mb-1 text-xs font-semibold text-neutral-500">
                            {message.sender.firstName} {message.sender.lastName}
                          </div>
                        )}
                        {message.content && <div className="whitespace-pre-wrap text-sm leading-6">{message.content}</div>}
                        {message.attachments.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {message.attachments.map((attachment) => (
                              <a
                                key={attachment.id}
                                href={resolveImageUrl(attachment.url)}
                                target="_blank"
                                rel="noreferrer"
                                className={`block rounded-2xl border px-3 py-2 text-sm ${isOwn ? 'border-white/20 bg-white/10' : 'border-neutral-200 bg-white'}`}
                              >
                                <div className="font-medium">{attachment.filename}</div>
                                <div className={`text-xs ${isOwn ? 'text-neutral-200' : 'text-neutral-500'}`}>
                                  {formatBytes(attachment.sizeBytes)}
                                </div>
                              </a>
                            ))}
                          </div>
                        )}
                        <div className={`mt-2 text-[11px] ${isOwn ? 'text-neutral-300' : 'text-neutral-500'}`}>
                          {formatRelative(message.createdAt)}
                          {isOwn ? ` · ${getReceiptLabel(message.receiptSummary)}` : ''}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="border-t border-neutral-200 px-6 py-4">
              {selectedFile && (
                <div className="mb-3 inline-flex items-center gap-3 rounded-2xl bg-neutral-100 px-3 py-2 text-sm text-neutral-700">
                  <Paperclip size={16} />
                  <span>{selectedFile.name}</span>
                  <button onClick={() => setSelectedFile(null)} className="text-neutral-500">
                    <X size={14} />
                  </button>
                </div>
              )}

              <div className="flex items-end gap-3">
                <label className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-2xl border border-neutral-200 text-neutral-500">
                  <Paperclip size={18} />
                  <input
                    type="file"
                    className="hidden"
                    onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
                  />
                </label>

                <textarea
                  value={composerText}
                  onChange={(event) => setComposerText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void sendCurrentMessage();
                    }
                  }}
                  rows={1}
                  placeholder="Nachricht schreiben..."
                  className="min-h-12 flex-1 resize-none rounded-3xl border border-neutral-200 px-4 py-3 text-sm outline-none"
                />

                <button
                  onClick={() => void sendCurrentMessage()}
                  disabled={composerState === 'sending' || (!composerText.trim() && !selectedFile)}
                  className="flex h-12 w-12 items-center justify-center rounded-2xl bg-neutral-900 text-white disabled:cursor-not-allowed disabled:bg-neutral-300"
                >
                  {composerState === 'sending' ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
              </div>
              {error && <div className="mt-3 text-sm text-rose-600">{error}</div>}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function sortConversations(items: ChatConversation[]) {
  return [...items].sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getOwnUserId() {
  const token = localStorage.getItem('accessToken');
  if (!token) {
    return '';
  }
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub || '';
  } catch {
    return '';
  }
}

function getReceiptLabel(receiptSummary: ChatReceiptSummary) {
  if (receiptSummary.recipientCount === 0) {
    return 'Gesendet';
  }
  if (receiptSummary.status === 'read') {
    return receiptSummary.recipientCount > 1
      ? `Gelesen ${receiptSummary.readCount}/${receiptSummary.recipientCount}`
      : 'Gelesen';
  }
  if (receiptSummary.status === 'delivered') {
    return receiptSummary.recipientCount > 1
      ? `Zugestellt ${receiptSummary.deliveredCount}/${receiptSummary.recipientCount}`
      : 'Zugestellt';
  }
  return 'Gesendet';
}
