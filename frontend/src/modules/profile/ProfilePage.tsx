import { useState, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api, apiPost, apiPatch, resolveImageUrl } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import { User, Lock, Mail, Phone, Building2, Save, Check, AlertCircle, Eye, EyeOff, Camera, Briefcase, Clock } from 'lucide-react';
import AvatarCropModal from '../../components/AvatarCropModal';

export default function ProfilePage() {
  const { user, fetchMe } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'profile' | 'time' | 'password'>('profile');

  return (
    <div className="max-w-2xl space-y-6">
      {/* Avatar + Name */}
      <div className="card p-6 flex items-center gap-6">
        <AvatarUpload />
        <div>
          <h2 className="text-xl font-bold text-neutral-800 dark:text-neutral-100">{user?.firstName} {user?.lastName}</h2>
          <p className="text-neutral-500">{user?.email}</p>
          <p className="text-sm text-neutral-400 mt-1">{user?.position} {user?.department ? `· ${user.department}` : ''}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-neutral-100 dark:bg-neutral-800 rounded-lg p-0.5 w-fit">
        <button onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors ${activeTab === 'profile' ? 'bg-white dark:bg-neutral-700 shadow-sm text-neutral-800 dark:text-neutral-100' : 'text-neutral-500'}`}>
          <User size={16} /> Profil
        </button>
        <button onClick={() => setActiveTab('time')}
          className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors ${activeTab === 'time' ? 'bg-white dark:bg-neutral-700 shadow-sm text-neutral-800 dark:text-neutral-100' : 'text-neutral-500'}`}>
          <Clock size={16} /> Zeiterfassung
        </button>
        <button onClick={() => setActiveTab('password')}
          className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors ${activeTab === 'password' ? 'bg-white dark:bg-neutral-700 shadow-sm text-neutral-800 dark:text-neutral-100' : 'text-neutral-500'}`}>
          <Lock size={16} /> Passwort
        </button>
      </div>

      {activeTab === 'profile' && <ProfileForm />}
      {activeTab === 'time' && <TimeSettingsForm />}
      {activeTab === 'password' && <PasswordForm />}
    </div>
  );
}

const WEEKDAYS = [
  { num: 1, short: 'Mo', label: 'Montag' },
  { num: 2, short: 'Di', label: 'Dienstag' },
  { num: 3, short: 'Mi', label: 'Mittwoch' },
  { num: 4, short: 'Do', label: 'Donnerstag' },
  { num: 5, short: 'Fr', label: 'Freitag' },
  { num: 6, short: 'Sa', label: 'Samstag' },
  { num: 7, short: 'So', label: 'Sonntag' },
];

function TimeSettingsForm() {
  const { user, fetchMe } = useAuthStore();
  const u: any = user || {};

  // Parse initialBalanceMinutes into hours+minutes (can be negative)
  const initialMin = u.initialBalanceMinutes || 0;
  const initialHoursAbs = Math.floor(Math.abs(initialMin) / 60);
  const initialMinsAbs = Math.abs(initialMin) % 60;
  const initialSign = initialMin < 0 ? '-' : '+';

  const [weeklyHours, setWeeklyHours] = useState(String(u.weeklyTargetHours || '40'));
  const [sign, setSign] = useState<'+' | '-'>(initialSign as '+' | '-');
  const [balanceHours, setBalanceHours] = useState(String(initialHoursAbs));
  const [balanceMins, setBalanceMins] = useState(String(initialMinsAbs));
  const [workingDays, setWorkingDays] = useState<number[]>(u.workingDays || [1, 2, 3, 4, 5]);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const updateMut = useMutation({
    mutationFn: (data: any) => apiPatch('/auth/me', data),
    onSuccess: () => {
      fetchMe();
      setSaved(true);
      setError('');
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (e: any) => setError(e?.message || 'Fehler beim Speichern'),
  });

  const toggleDay = (day: number) => {
    setWorkingDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort());
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const hours = parseFloat(weeklyHours);
    const bh = parseInt(balanceHours, 10) || 0;
    const bm = parseInt(balanceMins, 10) || 0;
    if (isNaN(hours) || hours <= 0 || hours > 168) {
      setError('Wochenstunden müssen zwischen 0 und 168 liegen');
      return;
    }
    if (workingDays.length === 0) {
      setError('Mindestens ein Arbeitstag muss ausgewählt sein');
      return;
    }
    const totalMinutes = (sign === '-' ? -1 : 1) * (bh * 60 + bm);
    updateMut.mutate({
      weeklyTargetHours: hours,
      initialBalanceMinutes: totalMinutes,
      workingDays,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="card p-6 space-y-5">
      <div>
        <h3 className="font-semibold text-neutral-800 dark:text-neutral-100 mb-1">Arbeitszeit-Einstellungen</h3>
        <p className="text-xs text-neutral-500">Diese Werte werden für die Berechnung deines Saldos verwendet.</p>
      </div>

      <div>
        <label className="label">Wochenstunden (Soll)</label>
        <input
          type="number"
          step="0.5"
          min="0"
          max="168"
          className="input"
          value={weeklyHours}
          onChange={(e) => setWeeklyHours(e.target.value)}
        />
        <p className="text-xs text-neutral-400 mt-1">z.B. 40 für Vollzeit, 20 für 50% Teilzeit</p>
      </div>

      <div>
        <label className="label">Arbeitstage</label>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((d) => (
            <button
              key={d.num}
              type="button"
              onClick={() => toggleDay(d.num)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                workingDays.includes(d.num)
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-700'
              }`}
              title={d.label}
            >
              {d.short}
            </button>
          ))}
        </div>
        <p className="text-xs text-neutral-400 mt-2">
          Tagessoll: {workingDays.length > 0 ? (parseFloat(weeklyHours) / workingDays.length).toFixed(2) : '--'}h bei {workingDays.length} Tagen
        </p>
      </div>

      <div>
        <label className="label">Übertragene Zeit (Saldo zum Startzeitpunkt)</label>
        <div className="flex gap-2 items-center">
          <div className="flex bg-neutral-100 dark:bg-neutral-800 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setSign('+')}
              className={`px-3 py-1.5 rounded text-sm font-semibold ${sign === '+' ? 'bg-emerald-500 text-white' : 'text-neutral-500'}`}
            >
              + Gut
            </button>
            <button
              type="button"
              onClick={() => setSign('-')}
              className={`px-3 py-1.5 rounded text-sm font-semibold ${sign === '-' ? 'bg-red-500 text-white' : 'text-neutral-500'}`}
            >
              − Minus
            </button>
          </div>
          <input
            type="number"
            min="0"
            className="input flex-1"
            value={balanceHours}
            onChange={(e) => setBalanceHours(e.target.value)}
            placeholder="Stunden"
          />
          <span className="text-neutral-400">h</span>
          <input
            type="number"
            min="0"
            max="59"
            className="input flex-1"
            value={balanceMins}
            onChange={(e) => setBalanceMins(e.target.value)}
            placeholder="Minuten"
          />
          <span className="text-neutral-400">min</span>
        </div>
        <p className="text-xs text-neutral-400 mt-1">Startsaldo bei der Einführung des Systems</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <button type="submit" className="btn-primary" disabled={updateMut.isPending}>
        {updateMut.isPending ? 'Speichern...' : saved ? (
          <><Check size={16} /> Gespeichert</>
        ) : (
          <><Save size={16} /> Änderungen speichern</>
        )}
      </button>
    </form>
  );
}

function AvatarUpload() {
  const { user, fetchMe } = useAuthStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  const uploadMut = useMutation({
    mutationFn: async (blob: Blob) => {
      const formData = new FormData();
      formData.append('file', blob, 'avatar.jpg');
      return api<{ avatarUrl: string }>('/files/avatar', {
        method: 'POST',
        body: formData,
      });
    },
    onSuccess: () => fetchMe(),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCrop = (blob: Blob) => {
    setCropSrc(null);
    uploadMut.mutate(blob);
  };

  return (
    <>
      <div className="relative group cursor-pointer" onClick={() => fileRef.current?.click()}>
        <div className="w-20 h-20 rounded-full overflow-hidden bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center">
          {user?.avatarUrl ? (
            <img
              src={resolveImageUrl(user.avatarUrl)}
              className="w-20 h-20 rounded-full object-cover"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
          ) : (
            <span className="text-2xl font-bold" style={{ color: 'var(--color-accent)' }}>
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </span>
          )}
        </div>
        <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Camera size={20} className="text-white" />
        </div>
        {uploadMut.isPending && (
          <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} />
      </div>
      {cropSrc && <AvatarCropModal imageSrc={cropSrc} onCrop={handleCrop} onClose={() => setCropSrc(null)} />}
    </>
  );
}

function ProfileForm() {
  const { user, fetchMe } = useAuthStore();
  const [form, setForm] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    phone: (user as any)?.phone || '',
  });
  const [saved, setSaved] = useState(false);

  const updateMutation = useMutation({
    mutationFn: (data: any) => apiPatch('/auth/me', data),
    onSuccess: () => {
      fetchMe();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(form);
  };

  return (
    <div className="card p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Vorname</label>
            <input className="input" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
          </div>
          <div>
            <label className="label">Nachname</label>
            <input className="input" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label">E-Mail</label>
          <input className="input bg-neutral-50 dark:bg-neutral-800" value={user?.email || ''} readOnly />
          <p className="text-xs text-neutral-400 mt-1">E-Mail kann nur vom Admin geändert werden</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Telefon</label>
            <input className="input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="label">Abteilung</label>
            <input className="input bg-neutral-50 dark:bg-neutral-800" value={(user as any)?.department || ''} readOnly />
          </div>
        </div>
        <div>
          <label className="label">Position</label>
          <input className="input bg-neutral-50 dark:bg-neutral-800" value={(user as any)?.position || ''} readOnly />
        </div>
        <p className="text-xs text-neutral-400">Abteilung und Position können über die Benutzerverwaltung (Admin) geändert werden.</p>

        <div className="flex items-center gap-3">
          <button type="submit" className="btn-primary" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? 'Speichern...' : saved ? (
              <><Check size={16} /> Gespeichert</>
            ) : (
              <><Save size={16} /> Änderungen speichern</>
            )}
          </button>
        </div>
      </form>
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
        <div className="flex items-center gap-2 p-3 mb-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg text-emerald-700 dark:text-emerald-300 text-sm">
          <Check size={16} /> Passwort erfolgreich geändert
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Aktuelles Passwort</label>
          <div className="relative">
            <input className="input pr-10" type={showPasswords ? 'text' : 'password'} required
              value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
            <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400"
              onClick={() => setShowPasswords(!showPasswords)}>
              {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div>
          <label className="label">Neues Passwort</label>
          <input className="input" type={showPasswords ? 'text' : 'password'} required minLength={8}
            value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
          <p className="text-xs text-neutral-400 mt-1">Mindestens 8 Zeichen, ein Großbuchstabe, eine Zahl</p>
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
