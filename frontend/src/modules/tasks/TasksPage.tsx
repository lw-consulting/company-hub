import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import {
  Plus, X, CheckCircle, Circle, Clock, AlertTriangle, ArrowUp,
  ArrowDown, Minus, MessageSquare, CalendarDays, User,
} from 'lucide-react';

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  completedAt: string | null;
  createdAt: string;
  createdById: string;
  creatorFirstName: string;
  creatorLastName: string;
  assignedToId: string | null;
  assignee: { firstName: string; lastName: string } | null;
}

const STATUS_OPTIONS = [
  { value: 'open', label: 'Offen', icon: Circle, color: 'text-neutral-400' },
  { value: 'in_progress', label: 'In Arbeit', icon: Clock, color: 'text-blue-500' },
  { value: 'done', label: 'Erledigt', icon: CheckCircle, color: 'text-emerald-500' },
  { value: 'cancelled', label: 'Abgebrochen', icon: X, color: 'text-neutral-300' },
];

const PRIORITY_OPTIONS = [
  { value: 'urgent', label: 'Dringend', icon: AlertTriangle, color: 'text-red-500' },
  { value: 'high', label: 'Hoch', icon: ArrowUp, color: 'text-orange-500' },
  { value: 'medium', label: 'Mittel', icon: Minus, color: 'text-blue-500' },
  { value: 'low', label: 'Niedrig', icon: ArrowDown, color: 'text-neutral-400' },
];

export default function TasksPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<'all' | 'me' | 'created'>('me');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data: tasksData, isLoading } = useQuery({
    queryKey: ['tasks', filter, statusFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (filter !== 'all') params.set('assignedTo', filter);
      if (statusFilter) params.set('status', statusFilter);
      return apiGet<{ data: Task[]; total: number }>(`/tasks?${params}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Record<string, any>) =>
      apiPatch(`/tasks/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const tasks = tasksData?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {/* Filter tabs */}
          <div className="flex bg-surface-tertiary rounded-lg p-0.5">
            {[
              { key: 'me', label: 'Meine' },
              { key: 'created', label: 'Erstellt' },
              { key: 'all', label: 'Alle' },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key as any)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  filter === f.key ? 'bg-white shadow-sm text-neutral-800' : 'text-neutral-500'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <select
            className="input w-auto text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Alle Status</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <button onClick={() => setShowForm(true)} className="btn-primary">
          <Plus size={18} /> Aufgabe erstellen
        </button>
      </div>

      {/* Task counts */}
      <div className="flex gap-4 text-sm">
        <span className="text-neutral-500">{tasksData?.total || 0} Aufgaben</span>
        <span className="text-emerald-600">
          {tasks.filter((t) => t.status === 'done').length} erledigt
        </span>
        <span className="text-blue-600">
          {tasks.filter((t) => t.status === 'in_progress').length} in Arbeit
        </span>
      </div>

      {/* Tasks list */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="text-center py-12 text-neutral-400">Laden...</div>
        ) : tasks.length === 0 ? (
          <div className="card p-12 text-center text-neutral-400">
            Keine Aufgaben gefunden
          </div>
        ) : (
          tasks.map((task) => {
            const statusConf = STATUS_OPTIONS.find((s) => s.value === task.status) || STATUS_OPTIONS[0];
            const prioConf = PRIORITY_OPTIONS.find((p) => p.value === task.priority) || PRIORITY_OPTIONS[2];
            const StatusIcon = statusConf.icon;
            const PrioIcon = prioConf.icon;
            const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'done';

            return (
              <div key={task.id} className={`card p-4 flex items-center gap-4 ${task.status === 'done' ? 'opacity-60' : ''}`}>
                {/* Status toggle */}
                <button
                  onClick={() => {
                    const nextStatus = task.status === 'done' ? 'open' : 'done';
                    updateMutation.mutate({ id: task.id, status: nextStatus });
                  }}
                  className={`flex-shrink-0 ${statusConf.color} hover:text-emerald-500 transition-colors`}
                >
                  <StatusIcon size={22} />
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className={`font-medium ${task.status === 'done' ? 'line-through text-neutral-400' : 'text-neutral-800'}`}>
                    {task.title}
                  </div>
                  {task.description && (
                    <div className="text-sm text-neutral-400 truncate mt-0.5">{task.description}</div>
                  )}
                </div>

                {/* Meta */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  {/* Priority */}
                  <span className={`${prioConf.color}`} title={prioConf.label}>
                    <PrioIcon size={16} />
                  </span>

                  {/* Due date */}
                  {task.dueDate && (
                    <span className={`text-xs flex items-center gap-1 ${isOverdue ? 'text-red-500 font-medium' : 'text-neutral-400'}`}>
                      <CalendarDays size={13} />
                      {new Date(task.dueDate + 'T00:00:00').toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit' })}
                    </span>
                  )}

                  {/* Assignee */}
                  {task.assignee && (
                    <span className="text-xs text-neutral-400 flex items-center gap-1" title={`${task.assignee.firstName} ${task.assignee.lastName}`}>
                      <User size={13} />
                      {task.assignee.firstName[0]}{task.assignee.lastName[0]}
                    </span>
                  )}

                  {/* Status select */}
                  <select
                    className="text-xs border border-border rounded px-1.5 py-1 bg-white text-neutral-600"
                    value={task.status}
                    onChange={(e) => updateMutation.mutate({ id: task.id, status: e.target.value })}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })
        )}
      </div>

      {showForm && <CreateTaskModal onClose={() => setShowForm(false)} />}
    </div>
  );
}

function CreateTaskModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    assignedTo: '',
    dueDate: '',
  });
  const [error, setError] = useState('');

  const { data: supervisors } = useQuery({
    queryKey: ['supervisors'],
    queryFn: () => apiGet<{ id: string; firstName: string; lastName: string; email: string }[]>('/users/supervisors'),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiPost('/tasks', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      onClose();
    },
    onError: (err: any) => setError(err?.message || 'Fehler'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      ...form,
      description: form.description || undefined,
      assignedTo: form.assignedTo || undefined,
      dueDate: form.dueDate || undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-neutral-800">Neue Aufgabe</h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600"><X size={20} /></button>
        </div>

        {error && <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Titel</label>
            <input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>

          <div>
            <label className="label">Beschreibung</label>
            <textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Priorität</label>
              <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Fällig am</label>
              <input type="date" className="input" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="label">Zuweisen an</label>
            <select className="input" value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}>
              <option value="">Nicht zugewiesen</option>
              {supervisors?.map((u) => (
                <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Abbrechen</button>
            <button type="submit" className="btn-primary" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Erstelle...' : 'Erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
