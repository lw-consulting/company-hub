import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiDelete } from '../../lib/api';
import { Plus, Trash2, X, MessageSquare, Megaphone } from 'lucide-react';

interface ForumGroup {
  id: string; name: string; icon: string | null; color: string;
  forums: { id: string; name: string; description: string | null; isAnnouncement: boolean; postCount: number }[];
}

export default function SettingsPage() {
  const [tab, setTab] = useState<'forums' | 'general'>('forums');

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex bg-neutral-100 dark:bg-neutral-800 rounded-xl p-0.5 w-fit">
        <button onClick={() => setTab('forums')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === 'forums' ? 'bg-white dark:bg-neutral-700 shadow-sm text-neutral-800 dark:text-white' : 'text-neutral-500'}`}>
          Community-Foren
        </button>
        <button onClick={() => setTab('general')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === 'general' ? 'bg-white dark:bg-neutral-700 shadow-sm text-neutral-800 dark:text-white' : 'text-neutral-500'}`}>
          Allgemein
        </button>
      </div>

      {tab === 'forums' ? <ForumsManager /> : <GeneralSettings />}
    </div>
  );
}

function ForumsManager() {
  const qc = useQueryClient();
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [showForumForm, setShowForumForm] = useState<string | null>(null);

  const { data: groups } = useQuery({
    queryKey: ['community-forums'],
    queryFn: () => apiGet<ForumGroup[]>('/community/forums'),
  });

  const deleteGroupMut = useMutation({
    mutationFn: (id: string) => apiDelete(`/community/forums/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['community-forums'] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-neutral-800 dark:text-white">Community-Foren verwalten</h3>
          <p className="text-sm text-neutral-400 mt-0.5">Erstellen Sie Foren-Gruppen und Sub-Foren für die Community.</p>
        </div>
        <button onClick={() => setShowGroupForm(true)} className="btn-primary text-sm">
          <Plus size={16} /> Gruppe erstellen
        </button>
      </div>

      {!groups?.length ? (
        <div className="card p-12 text-center text-neutral-400">
          <MessageSquare size={32} className="mx-auto mb-3 text-neutral-300" />
          <p>Noch keine Foren-Gruppen erstellt.</p>
          <p className="text-sm mt-1">Erstellen Sie eine Gruppe (z.B. "Allgemein") und fügen Sie Sub-Foren hinzu.</p>
        </div>
      ) : (
        groups.map(group => (
          <div key={group.id} className="card overflow-hidden">
            <div className="px-5 py-4 flex items-center gap-3 border-b border-neutral-100 dark:border-neutral-800">
              <div className="w-8 h-8 rounded-full text-white text-sm font-bold flex items-center justify-center"
                style={{ backgroundColor: group.color || '#1a1a1a' }}>
                {group.name[0]}
              </div>
              <span className="font-bold text-neutral-800 dark:text-white flex-1">{group.name}</span>
              <button onClick={() => setShowForumForm(group.id)} className="btn-ghost text-xs">
                <Plus size={14} /> Forum
              </button>
            </div>

            {group.forums.length === 0 ? (
              <div className="px-5 py-6 text-center text-sm text-neutral-400">
                Keine Foren in dieser Gruppe. Klicken Sie auf "+ Forum" um eines zu erstellen.
              </div>
            ) : (
              <div className="divide-y divide-neutral-50 dark:divide-neutral-800">
                {group.forums.map(forum => (
                  <div key={forum.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
                      {forum.isAnnouncement ? <Megaphone size={14} className="text-amber-500" /> : <MessageSquare size={14} className="text-neutral-400" />}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-neutral-700 dark:text-neutral-200 flex items-center gap-2">
                        {forum.name}
                        {forum.isAnnouncement && <span className="text-[10px] font-bold text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded">Ankündigung</span>}
                      </div>
                      {forum.description && <div className="text-xs text-neutral-400">{forum.description}</div>}
                    </div>
                    <span className="text-xs text-neutral-400">{forum.postCount} Posts</span>
                    <button onClick={() => deleteGroupMut.mutate(forum.id)} className="text-neutral-300 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}

      {showGroupForm && <CreateGroupModal onClose={() => setShowGroupForm(false)} />}
      {showForumForm && <CreateForumModal groupId={showForumForm} onClose={() => setShowForumForm(null)} />}
    </div>
  );
}

function CreateGroupModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', color: '#1a1a1a' });

  const createMut = useMutation({
    mutationFn: (data: any) => apiPost('/community/forum-groups', data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['community-forums'] }); onClose(); },
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="card p-6 w-full max-w-md">
        <div className="flex justify-between mb-4">
          <h3 className="font-bold text-neutral-800 dark:text-white">Neue Foren-Gruppe</h3>
          <button onClick={onClose}><X size={18} className="text-neutral-400" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); createMut.mutate(form); }} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input className="input" required placeholder="z.B. Allgemein" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Farbe</label>
            <div className="flex gap-2">
              <input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} className="w-10 h-10 rounded-lg cursor-pointer border border-neutral-200" />
              <input className="input flex-1" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">Abbrechen</button>
            <button type="submit" className="btn-primary" disabled={createMut.isPending}>Erstellen</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateForumModal({ groupId, onClose }: { groupId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', description: '', isAnnouncement: false });

  const createMut = useMutation({
    mutationFn: (data: any) => apiPost('/community/forums', { ...data, groupId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['community-forums'] }); onClose(); },
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="card p-6 w-full max-w-md">
        <div className="flex justify-between mb-4">
          <h3 className="font-bold text-neutral-800 dark:text-white">Neues Forum</h3>
          <button onClick={onClose}><X size={18} className="text-neutral-400" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); createMut.mutate(form); }} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input className="input" required placeholder="z.B. Ankündigungen & Neuigkeiten" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Beschreibung (optional)</label>
            <input className="input" placeholder="Kurze Beschreibung..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
            <input type="checkbox" checked={form.isAnnouncement} onChange={e => setForm({ ...form, isAnnouncement: e.target.checked })} />
            Ankündigungs-Forum (nur Admins können posten)
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">Abbrechen</button>
            <button type="submit" className="btn-primary" disabled={createMut.isPending}>Erstellen</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function GeneralSettings() {
  return (
    <div className="card p-6">
      <h3 className="font-bold text-neutral-800 dark:text-white mb-4">Allgemeine Einstellungen</h3>
      <p className="text-sm text-neutral-400">Weitere Einstellungen werden in kommenden Updates hinzugefügt.</p>
    </div>
  );
}
