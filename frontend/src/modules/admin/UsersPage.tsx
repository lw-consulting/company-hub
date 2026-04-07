import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiPut, apiDelete } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import { MODULES, ROLE_LABELS, type Role } from '@company-hub/shared';
import {
  Plus,
  Search,
  MoreVertical,
  Shield,
  Mail,
  X,
  Check,
  UserCog,
  ChevronDown,
} from 'lucide-react';

interface UserRow {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  department: string | null;
  position: string | null;
  isActive: boolean;
  supervisorId: string | null;
}

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingModules, setEditingModules] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const { data: usersData, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => apiGet<{ data: UserRow[]; total: number }>('/users?pageSize=100'),
  });

  const users = usersData?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-500 text-sm">
            {usersData?.total || 0} Benutzer gesamt
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="btn-primary"
        >
          <Plus size={18} />
          Benutzer anlegen
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          className="input pl-10"
          placeholder="Suchen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Users Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-secondary border-b border-border">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Name</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">E-Mail</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Rolle</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Abteilung</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-6 py-3">Module</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    Laden...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    Keine Benutzer gefunden
                  </td>
                </tr>
              ) : (
                users
                  .filter((u) => {
                    if (!search) return true;
                    const s = search.toLowerCase();
                    return (
                      u.firstName.toLowerCase().includes(s) ||
                      u.lastName.toLowerCase().includes(s) ||
                      u.email.toLowerCase().includes(s)
                    );
                  })
                  .map((user) => (
                    <tr key={user.id} className="hover:bg-surface-secondary/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center">
                            <span className="text-xs font-medium text-primary">
                              {user.firstName[0]}{user.lastName[0]}
                            </span>
                          </div>
                          <span className="font-medium text-slate-800">
                            {user.firstName} {user.lastName}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">{user.email}</td>
                      <td className="px-6 py-4">
                        <span className="badge-primary">
                          {ROLE_LABELS[user.role as Role] || user.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {user.department || '-'}
                      </td>
                      <td className="px-6 py-4">
                        {user.isActive ? (
                          <span className="badge-success">Aktiv</span>
                        ) : (
                          <span className="badge-danger">Inaktiv</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => setEditingModules(user.id)}
                          className="text-xs text-primary hover:text-primary-dark font-medium"
                        >
                          Verwalten
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <button className="text-slate-400 hover:text-slate-600 p-1">
                          <MoreVertical size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateForm && (
        <CreateUserModal onClose={() => setShowCreateForm(false)} />
      )}

      {/* Module Permissions Modal */}
      {editingModules && (
        <ModulePermissionsModal
          userId={editingModules}
          onClose={() => setEditingModules(null)}
        />
      )}
    </div>
  );
}

function CreateUserModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'user',
    department: '',
    position: '',
  });
  const [error, setError] = useState('');

  const { data: supervisors } = useQuery({
    queryKey: ['supervisors'],
    queryFn: () => apiGet<{ id: string; firstName: string; lastName: string; email: string }[]>('/users/supervisors'),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiPost('/users', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      onClose();
    },
    onError: (err: any) => {
      setError(err?.message || 'Fehler beim Erstellen');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      ...form,
      department: form.department || undefined,
      position: form.position || undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-slate-800">Neuer Benutzer</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Vorname</label>
              <input className="input" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </div>
            <div>
              <label className="label">Nachname</label>
              <input className="input" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="label">E-Mail</label>
            <input className="input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>

          <div>
            <label className="label">Passwort</label>
            <input className="input" type="password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </div>

          <div>
            <label className="label">Rolle</label>
            <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {Object.entries(ROLE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Abteilung</label>
              <input className="input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
            </div>
            <div>
              <label className="label">Position</label>
              <input className="input" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn-secondary">
              Abbrechen
            </button>
            <button type="submit" className="btn-primary" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Erstelle...' : 'Erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ModulePermissionsModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const queryClient = useQueryClient();

  const { data: permissions, isLoading } = useQuery({
    queryKey: ['user-modules', userId],
    queryFn: () => apiGet<{ userId: string; moduleId: string; isEnabled: boolean }[]>(`/users/${userId}/modules`),
  });

  const updateMutation = useMutation({
    mutationFn: (modules: { moduleId: string; isEnabled: boolean }[]) =>
      apiPut(`/users/${userId}/modules`, { modules }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-modules', userId] });
    },
  });

  const toggleModule = (moduleId: string, currentState: boolean) => {
    const allModules = MODULES.map((m) => {
      const existing = permissions?.find((p) => p.moduleId === m.id);
      if (m.id === moduleId) {
        return { moduleId: m.id, isEnabled: !currentState };
      }
      return { moduleId: m.id, isEnabled: existing?.isEnabled ?? m.defaultEnabled };
    });
    updateMutation.mutate(allModules);
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-slate-800">Modul-Berechtigungen</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-slate-400">Laden...</div>
        ) : (
          <div className="space-y-2">
            {MODULES.map((mod) => {
              const perm = permissions?.find((p) => p.moduleId === mod.id);
              const isEnabled = perm?.isEnabled ?? false;

              return (
                <div
                  key={mod.id}
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-surface-secondary"
                >
                  <div>
                    <div className="text-sm font-medium text-slate-700">{mod.name}</div>
                    <div className="text-xs text-slate-400">{mod.description}</div>
                  </div>
                  <button
                    onClick={() => toggleModule(mod.id, isEnabled)}
                    className={`w-10 h-6 rounded-full transition-colors relative ${
                      isEnabled ? 'bg-primary' : 'bg-slate-200'
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        isEnabled ? 'translate-x-4.5 left-0' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end pt-4 mt-4 border-t border-border-light">
          <button onClick={onClose} className="btn-primary">Fertig</button>
        </div>
      </div>
    </div>
  );
}
