import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, apiGet, apiPatch, apiPost, resolveImageUrl } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import type {
  NotificationPreferences,
  PushDevice,
  User as SharedUser,
} from '@company-hub/shared';
import {
  User,
  Lock,
  Save,
  Check,
  AlertCircle,
  Eye,
  EyeOff,
  Camera,
  Clock,
  Bell,
  Monitor,
  Mail,
  Smartphone,
  MessageSquare,
  Users,
  ClipboardList,
  CalendarDays,
  Plane,
  Bot,
  Settings2,
} from 'lucide-react';
import AvatarCropModal from '../../components/AvatarCropModal';

type PushConfig = {
  webPushEnabled: boolean;
  vapidPublicKey: string | null;
  expoPushEnabled: boolean;
  expoProjectId: string | null;
};

const WEEKDAYS = [
  { num: 1, short: 'Mo', label: 'Montag' },
  { num: 2, short: 'Di', label: 'Dienstag' },
  { num: 3, short: 'Mi', label: 'Mittwoch' },
  { num: 4, short: 'Do', label: 'Donnerstag' },
  { num: 5, short: 'Fr', label: 'Freitag' },
  { num: 6, short: 'Sa', label: 'Samstag' },
  { num: 7, short: 'So', label: 'Sonntag' },
];

const NOTIFICATION_SECTIONS: Array<{
  key: keyof NotificationPreferences;
  label: string;
  description: string;
  icon: typeof MessageSquare;
}> = [
  { key: 'chat', label: 'Chats', description: 'Direktnachrichten und Gruppenchats', icon: MessageSquare },
  { key: 'community', label: 'Community', description: 'Beiträge, Kommentare und Reaktionen', icon: Users },
  { key: 'tasks', label: 'Aufgaben', description: 'Neue Aufgaben und Zuweisungen', icon: ClipboardList },
  { key: 'calendar', label: 'Kalender', description: 'Einladungen und Änderungen an Terminen', icon: CalendarDays },
  { key: 'leave', label: 'Urlaub', description: 'Urlaubsanträge und Entscheidungen', icon: Plane },
  { key: 'time_tracking', label: 'Zeiterfassung', description: 'Freigaben und Zeitänderungen', icon: Clock },
  { key: 'ai_assistants', label: 'KI-Assistenten', description: 'Antworten und Hinweise aus Assistenten', icon: Bot },
  { key: 'system', label: 'System', description: 'Wichtige Portal- und Sicherheitsmeldungen', icon: Settings2 },
];

const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  chat: { inApp: true, email: false, push: true },
  community: { inApp: true, email: false, push: false },
  tasks: { inApp: true, email: true, push: true },
  calendar: { inApp: true, email: true, push: true },
  leave: { inApp: true, email: true, push: true },
  time_tracking: { inApp: true, email: true, push: false },
  ai_assistants: { inApp: true, email: false, push: false },
  system: { inApp: true, email: true, push: true },
};

function normalizeNotificationPreferences(
  value: SharedUser['notificationPreferences'] | undefined,
): NotificationPreferences {
  if (!value) return DEFAULT_NOTIFICATION_PREFERENCES;

  return NOTIFICATION_SECTIONS.reduce((acc, section) => {
    const current = value[section.key];
    acc[section.key] = {
      inApp: current?.inApp ?? DEFAULT_NOTIFICATION_PREFERENCES[section.key].inApp,
      email: current?.email ?? DEFAULT_NOTIFICATION_PREFERENCES[section.key].email,
      push: current?.push ?? DEFAULT_NOTIFICATION_PREFERENCES[section.key].push,
    };
    return acc;
  }, {} as NotificationPreferences);
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

export default function ProfilePage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'profile' | 'time' | 'notifications' | 'password'>('profile');

  return (
    <div className="max-w-4xl space-y-6">
      <div className="card p-6 flex items-center gap-6">
        <AvatarUpload />
        <div>
          <h2 className="text-xl font-bold text-neutral-800 dark:text-neutral-100">{user?.firstName} {user?.lastName}</h2>
          <p className="text-neutral-500">{user?.email}</p>
          <p className="text-sm text-neutral-400 mt-1">{user?.position} {user?.department ? `· ${user.department}` : ''}</p>
        </div>
      </div>

      <div className="flex flex-wrap bg-neutral-100 dark:bg-neutral-800 rounded-lg p-0.5 w-fit gap-0.5">
        <TabButton icon={User} active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} label="Profil" />
        <TabButton icon={Clock} active={activeTab === 'time'} onClick={() => setActiveTab('time')} label="Zeiterfassung" />
        <TabButton icon={Bell} active={activeTab === 'notifications'} onClick={() => setActiveTab('notifications')} label="Benachrichtigungen" />
        <TabButton icon={Lock} active={activeTab === 'password'} onClick={() => setActiveTab('password')} label="Passwort" />
      </div>

      {activeTab === 'profile' && <ProfileForm />}
      {activeTab === 'time' && <TimeSettingsForm />}
      {activeTab === 'notifications' && <NotificationSettingsForm />}
      {activeTab === 'password' && <PasswordForm />}
    </div>
  );
}

function TabButton({
  icon: Icon,
  active,
  onClick,
  label,
}: {
  icon: typeof User;
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors ${
        active
          ? 'bg-white dark:bg-neutral-700 shadow-sm text-neutral-800 dark:text-neutral-100'
          : 'text-neutral-500'
      }`}
    >
      <Icon size={16} /> {label}
    </button>
  );
}

function TimeSettingsForm() {
  const { user, fetchMe } = useAuthStore();
  const u: any = user || {};

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
    setWorkingDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
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
          <input type="number" min="0" className="input flex-1" value={balanceHours} onChange={(e) => setBalanceHours(e.target.value)} placeholder="Stunden" />
          <span className="text-neutral-400">h</span>
          <input type="number" min="0" max="59" className="input flex-1" value={balanceMins} onChange={(e) => setBalanceMins(e.target.value)} placeholder="Minuten" />
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
        {updateMut.isPending ? 'Speichern...' : saved ? <><Check size={16} /> Gespeichert</> : <><Save size={16} /> Änderungen speichern</>}
      </button>
    </form>
  );
}

function NotificationSettingsForm() {
  const { user, fetchMe } = useAuthStore();
  const [preferences, setPreferences] = useState<NotificationPreferences>(
    normalizeNotificationPreferences(user?.notificationPreferences),
  );
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [browserPushBusy, setBrowserPushBusy] = useState(false);

  useEffect(() => {
    setPreferences(normalizeNotificationPreferences(user?.notificationPreferences));
  }, [user?.notificationPreferences]);

  const pushConfigQuery = useQuery({
    queryKey: ['notification-push-config'],
    queryFn: () => apiGet<PushConfig>('/notifications/push-config'),
  });

  const devicesQuery = useQuery({
    queryKey: ['notification-devices'],
    queryFn: () => apiGet<PushDevice[]>('/notifications/push-devices'),
  });

  const saveMutation = useMutation({
    mutationFn: (data: Partial<NotificationPreferences>) => apiPatch('/auth/me', { notificationPreferences: data }),
    onSuccess: async () => {
      await fetchMe();
      setSaved(true);
      setError('');
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (err: any) => setError(err?.message || 'Fehler beim Speichern'),
  });

  const toggleDeviceMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) => apiPatch(`/notifications/push-devices/${id}`, { enabled }),
    onSuccess: () => devicesQuery.refetch(),
    onError: (err: any) => setError(err?.message || 'Gerät konnte nicht aktualisiert werden'),
  });

  const updateChannel = (
    section: keyof NotificationPreferences,
    channel: keyof NotificationPreferences[keyof NotificationPreferences],
    value: boolean,
  ) => {
    setPreferences((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [channel]: value,
      },
    }));
  };

  const handleEnableBrowserPush = async () => {
    setBrowserPushBusy(true);
    setError('');

    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        throw new Error('Dieser Browser unterstützt keine Push-Benachrichtigungen.');
      }

      const config = pushConfigQuery.data;
      if (!config?.webPushEnabled || !config.vapidPublicKey) {
        throw new Error('Browser-Push ist serverseitig noch nicht konfiguriert.');
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error('Die Browser-Berechtigung für Benachrichtigungen wurde nicht erteilt.');
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(config.vapidPublicKey),
        });
      }

      await apiPost('/notifications/push/web-subscription', subscription.toJSON());
      await devicesQuery.refetch();
    } catch (err: any) {
      setError(err?.message || 'Browser-Push konnte nicht aktiviert werden.');
    } finally {
      setBrowserPushBusy(false);
    }
  };

  const handleDisableBrowserPush = async () => {
    setBrowserPushBusy(true);
    setError('');

    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (subscription) {
          await subscription.unsubscribe();
        }
      }

      const webDevices = (devicesQuery.data || []).filter((device) => device.platform === 'web' && device.enabled);
      await Promise.all(webDevices.map((device) => toggleDeviceMutation.mutateAsync({ id: device.id, enabled: false })));
    } catch (err: any) {
      setError(err?.message || 'Browser-Push konnte nicht deaktiviert werden.');
    } finally {
      setBrowserPushBusy(false);
    }
  };

  const browserPushEnabled = Boolean((devicesQuery.data || []).some((device) => device.platform === 'web' && device.enabled));

  return (
    <div className="space-y-6">
      <div className="card p-6 space-y-5">
        <div>
          <h3 className="font-semibold text-neutral-800 dark:text-neutral-100 mb-1">Benachrichtigungseinstellungen</h3>
          <p className="text-sm text-neutral-500">
            Lege fest, welche Bereiche dich im Portal, per E-Mail und per Push benachrichtigen dürfen.
          </p>
        </div>

        <div className="grid gap-3">
          {NOTIFICATION_SECTIONS.map((section) => {
            const Icon = section.icon;
            const value = preferences[section.key];

            return (
              <div key={section.key} className="rounded-2xl border border-neutral-200 dark:border-neutral-800 p-4 bg-white dark:bg-neutral-900/50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-600 dark:text-neutral-200">
                      <Icon size={18} />
                    </div>
                    <div>
                      <div className="font-medium text-neutral-800 dark:text-neutral-100">{section.label}</div>
                      <p className="text-sm text-neutral-500">{section.description}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <ChannelToggle label="Portal" icon={Bell} checked={value.inApp} onChange={(next) => updateChannel(section.key, 'inApp', next)} />
                    <ChannelToggle label="E-Mail" icon={Mail} checked={value.email} onChange={(next) => updateChannel(section.key, 'email', next)} />
                    <ChannelToggle label="Push" icon={Smartphone} checked={value.push} onChange={(next) => updateChannel(section.key, 'push', next)} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button type="button" className="btn-primary" onClick={() => saveMutation.mutate(preferences)} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Speichern...' : saved ? <><Check size={16} /> Gespeichert</> : <><Save size={16} /> Einstellungen speichern</>}
          </button>
          <p className="text-xs text-neutral-400">
            E-Mail-Versand funktioniert über SMTP und respektiert diese Einstellungen sofort.
          </p>
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="font-semibold text-neutral-800 dark:text-neutral-100">Browser-Push</h3>
            <p className="text-sm text-neutral-500">
              Aktiviere Push-Benachrichtigungen für diesen Browser. Der Service Worker ist bereits vorbereitet.
            </p>
          </div>
          <div className={`text-xs font-medium px-2.5 py-1 rounded-full ${browserPushEnabled ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-300'}`}>
            {browserPushEnabled ? 'Aktiv' : 'Inaktiv'}
          </div>
        </div>

        {!pushConfigQuery.data?.webPushEnabled && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200 px-4 py-3 text-sm">
            Browser-Push ist serverseitig noch nicht vollständig konfiguriert. Es fehlt aktuell ein VAPID-Schlüsselpaar.
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn-secondary" onClick={handleEnableBrowserPush} disabled={browserPushBusy || !pushConfigQuery.data?.webPushEnabled}>
            <Monitor size={16} /> {browserPushEnabled ? 'Erneut registrieren' : 'Browser-Push aktivieren'}
          </button>
          {browserPushEnabled && (
            <button type="button" className="btn-secondary" onClick={handleDisableBrowserPush} disabled={browserPushBusy}>
              <Monitor size={16} /> Browser-Push deaktivieren
            </button>
          )}
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium text-neutral-700 dark:text-neutral-200">Registrierte Geräte</div>
          <div className="space-y-2">
            {(devicesQuery.data || []).length === 0 && (
              <div className="text-sm text-neutral-500">Noch keine Push-Geräte registriert.</div>
            )}
            {(devicesQuery.data || []).map((device) => (
              <div key={device.id} className="flex items-center justify-between rounded-xl border border-neutral-200 dark:border-neutral-800 px-4 py-3">
                <div className="min-w-0">
                  <div className="font-medium text-sm text-neutral-800 dark:text-neutral-100 flex items-center gap-2">
                    {device.platform === 'web' ? <Monitor size={15} /> : <Smartphone size={15} />}
                    {device.platform === 'web' ? 'Browser' : 'Mobile App'}
                  </div>
                  <div className="text-xs text-neutral-500 truncate max-w-[26rem]">{device.endpoint}</div>
                </div>
                <button
                  type="button"
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${device.enabled ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-300'}`}
                  onClick={() => toggleDeviceMutation.mutate({ id: device.id, enabled: !device.enabled })}
                >
                  {device.enabled ? 'Aktiv' : 'Deaktiviert'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChannelToggle({
  label,
  icon: Icon,
  checked,
  onChange,
}: {
  label: string;
  icon: typeof Bell;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
      <Icon size={14} />
      <span>{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-neutral-900 dark:bg-white' : 'bg-neutral-300 dark:bg-neutral-700'}`}
      >
        <span className={`inline-block h-5 w-5 transform rounded-full bg-white dark:bg-neutral-900 transition-transform ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
      </button>
    </label>
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

  useEffect(() => {
    setForm({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      phone: (user as any)?.phone || '',
    });
  }, [user?.firstName, user?.lastName, (user as any)?.phone]);

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
            <input className="input" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          </div>
          <div>
            <label className="label">Nachname</label>
            <input className="input" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
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
            <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
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
            {updateMutation.isPending ? 'Speichern...' : saved ? <><Check size={16} /> Gespeichert</> : <><Save size={16} /> Änderungen speichern</>}
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
            <input className="input pr-10" type={showPasswords ? 'text' : 'password'} required value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
            <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400" onClick={() => setShowPasswords(!showPasswords)}>
              {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div>
          <label className="label">Neues Passwort</label>
          <input className="input" type={showPasswords ? 'text' : 'password'} required minLength={8} value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
          <p className="text-xs text-neutral-400 mt-1">Mindestens 8 Zeichen, ein Großbuchstabe, eine Zahl</p>
        </div>
        <div>
          <label className="label">Passwort bestätigen</label>
          <input className="input" type={showPasswords ? 'text' : 'password'} required value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} />
        </div>
        <button type="submit" className="btn-primary" disabled={changeMutation.isPending}>
          {changeMutation.isPending ? 'Ändere...' : 'Passwort ändern'}
        </button>
      </form>
    </div>
  );
}
