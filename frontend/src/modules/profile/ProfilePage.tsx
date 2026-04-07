import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import { User, Lock, Mail, Phone, Building2, Save, Check, AlertCircle, Eye, EyeOff } from 'lucide-react';

export default function ProfilePage() {
  const { user, fetchMe } = useAuthStore();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');

  return (
    <div className="max-w-2xl space-y-6">
      {/* Avatar + Name */}
      <div className="card p-6 flex items-center gap-6">
        <div className="w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} className="w-20 h-20 rounded-full object-cover" />
          ) : (
            <span className="text-2xl font-bold text-indigo-600">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </span>
          )}
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">{user?.firstName} {user?.lastName}</h2>
          <p className="text-slate-500">{user?.email}</p>
          <p className="text-sm text-slate-400 mt-1">{user?.position} {user?.department ? `· ${user.department}` : ''}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-slate-100 rounded-lg p-0.5 w-fit">
        <button onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors ${activeTab === 'profile' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>
          <User size={16} /> Profil
        </button>
        <button onClick={() => setActiveTab('password')}
          className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors ${activeTab === 'password' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500'}`}>
          <Lock size={16} /> Passwort
        </button>
      </div>

      {activeTab === 'profile' ? <ProfileForm /> : <PasswordForm />}
    </div>
  );
}

function ProfileForm() {
  const { user, fetchMe } = useAuthStore();
  const [form, setForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    phone: (user as any)?.phone || '',
    department: (user as any)?.department || '',
    position: (user as any)?.position || '',
  });
  const [saved, setSaved] = useState(false);

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiPatch(`/auth/me`, data),
    onSuccess: () => {
      fetchMe();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  // Note: /auth/me PATCH doesn't exist yet - we'd need to add it.
  // For now show the form as read-only display.

  return (
    <div className="card p-6 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Vorname</label>
          <input className="input" value={form.firstName} readOnly />
        </div>
        <div>
          <label className="label">Nachname</label>
          <input className="input" value={form.lastName} readOnly />
        </div>
      </div>
      <div>
        <label className="label">E-Mail</label>
        <input className="input bg-slate-50" value={user?.email || ''} readOnly />
        <p className="text-xs text-slate-400 mt-1">E-Mail kann nur vom Admin geändert werden</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Telefon</label>
          <input className="input" value={form.phone} readOnly />
        </div>
        <div>
          <label className="label">Abteilung</label>
          <input className="input" value={form.department} readOnly />
        </div>
      </div>
      <div>
        <label className="label">Position</label>
        <input className="input" value={form.position} readOnly />
      </div>
      <p className="text-xs text-slate-400">Profiländerungen können über die Benutzerverwaltung (Admin) vorgenommen werden.</p>
    </div>
  );
}

function PasswordForm() {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [showPasswords, setShowPasswords] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const changeMutation = useMutation({
    mutationFn: (data: any) => apiPost('/auth/change-password', data),
    onSuccess: () => {
      setSuccess(true);
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setSuccess(false), 3000);
    },
    onError: (err: any) => setError(err?.message || 'Fehler'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.newPassword !== form.confirmPassword) {
      setError('Passwörter stimmen nicht überein');
      return;
    }
    changeMutation.mutate({ currentPassword: form.currentPassword, newPassword: form.newPassword });
  };

  return (
    <div className="card p-6">
      {success && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-emerald-50 border border-emerald-200 rounded text-emerald-700 text-sm">
          <Check size={16} /> Passwort erfolgreich geändert
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Aktuelles Passwort</label>
          <div className="relative">
            <input className="input pr-10" type={showPasswords ? 'text' : 'password'} required
              value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
            <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
              onClick={() => setShowPasswords(!showPasswords)}>
              {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div>
          <label className="label">Neues Passwort</label>
          <input className="input" type={showPasswords ? 'text' : 'password'} required minLength={8}
            value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
          <p className="text-xs text-slate-400 mt-1">Mindestens 8 Zeichen, ein Großbuchstabe, eine Zahl</p>
        </div>
        <div>
          <label className="label">Passwort bestätigen</label>
          <input className="input" type={showPasswords ? 'text' : 'password'} required
            value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} />
        </div>
        <button type="submit" className="btn-primary" disabled={changeMutation.isPending}>
          {changeMutation.isPending ? 'Ändere...' : 'Passwort ändern'}
        </button>
      </form>
    </div>
  );
}
