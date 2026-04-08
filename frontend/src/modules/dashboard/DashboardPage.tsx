import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet, resolveImageUrl } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import { ROLE_HIERARCHY, type Role } from '@company-hub/shared';
import {
  Clock, Palmtree, CheckSquare, MessageSquare, TrendingUp, ArrowRight, Zap,
  Play, Square,
} from 'lucide-react';

interface TimeEntry {
  id: string;
  clockIn: string;
  clockOut: string | null;
  breakMinutes: number;
  actualBreakMinutes?: number;
  isOnBreak?: boolean;
  breaks?: Array<{
    id: string;
    startedAt: string;
    endedAt: string | null;
    durationMinutes: number;
  }>;
}

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  assignedToId: string | null;
}

interface FeedPost {
  id: string;
  content: string;
  createdAt: string;
  authorFirstName: string;
  authorLastName: string;
  authorAvatarUrl: string | null;
  totalReactions: number;
  commentCount: number;
}

interface DashboardPageProps {
  onNavigate: (path: string) => void;
}

function getTodayRange() {
  const today = new Date();
  const start = today.toISOString().split('T')[0];
  return { start, end: start };
}

function formatDuration(minutes: number) {
  const h = Math.floor(Math.abs(minutes) / 60);
  const m = Math.round(Math.abs(minutes) % 60);
  return `${minutes < 0 ? '-' : ''}${h}:${m.toString().padStart(2, '0')}`;
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'gerade eben';
  if (m < 60) return `vor ${m} Min.`;
  const h = Math.floor(m / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.floor(h / 24);
  if (d < 7) return `vor ${d} Tagen`;
  return new Date(dateStr).toLocaleDateString('de-AT');
}

export default function DashboardPage({ onNavigate }: DashboardPageProps) {
  const { user } = useAuthStore();
  const isAdmin = ROLE_HIERARCHY[(user?.role as Role) || 'user'] >= ROLE_HIERARCHY.admin;
  const today = getTodayRange();

  // Active time entry
  const { data: activeEntry } = useQuery({
    queryKey: ['time-active'],
    queryFn: () => apiGet<TimeEntry | null>('/time-tracking/active'),
    refetchInterval: 60_000,
  });

  // Today's time summary
  const { data: todaySummary } = useQuery({
    queryKey: ['time-summary', today.start, today.end],
    queryFn: () => apiGet<any>(`/time-tracking/summary?start=${today.start}&end=${today.end}`),
  });

  // Open tasks (assigned to me)
  const { data: tasksData } = useQuery({
    queryKey: ['dashboard-tasks'],
    queryFn: () => apiGet<{ data: Task[] }>('/tasks?status=open&assignedTo=me&pageSize=5'),
  });

  // Community feed
  const { data: feedData } = useQuery({
    queryKey: ['dashboard-feed'],
    queryFn: () => apiGet<{ data: FeedPost[] }>('/community/feed?pageSize=5'),
  });

  // Live timer tick
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!activeEntry) return;
    const i = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(i);
  }, [activeEntry]);

  // Calculate current working time
  let currentWorkTime = '--:--';
  if (activeEntry) {
    const elapsed = Math.floor((Date.now() - new Date(activeEntry.clockIn).getTime()) / 60000);
    const breakMinutes = activeEntry.breaks?.length
      ? activeEntry.breaks.reduce((total, entryBreak) => {
          const end = entryBreak.endedAt ? new Date(entryBreak.endedAt) : new Date();
          const start = new Date(entryBreak.startedAt);
          return total + Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
        }, 0)
      : (activeEntry.actualBreakMinutes ?? activeEntry.breakMinutes);
    const net = Math.max(0, elapsed - breakMinutes);
    currentWorkTime = formatDuration(net);
  } else if (todaySummary?.totalMinutes) {
    currentWorkTime = formatDuration(todaySummary.totalMinutes);
  }

  const openTasksCount = tasksData?.data?.filter((t: any) => t.status !== 'done').length || 0;
  const newPostsCount = feedData?.data?.length || 0;

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Welcome */}
      <div>
        <h2 className="text-3xl font-bold text-neutral-900 dark:text-white">
          Guten Tag, {user?.firstName}
        </h2>
        <p className="text-neutral-500 mt-1 text-lg">Hier ist deine Übersicht für heute.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Clock}
          label="Arbeitszeit"
          value={currentWorkTime}
          sublabel={activeEntry ? 'Läuft gerade' : 'Heute'}
          onClick={() => onNavigate('/time-tracking')}
          active={!!activeEntry}
        />
        <StatCard
          icon={Palmtree}
          label="Resturlaub"
          value={`${user?.vacationDaysPerYear || 25}`}
          sublabel="Tage verfügbar"
          accent
          onClick={() => onNavigate('/leave')}
        />
        <StatCard
          icon={CheckSquare}
          label="Aufgaben"
          value={String(openTasksCount)}
          sublabel="Offen"
          onClick={() => onNavigate('/tasks')}
        />
        <StatCard
          icon={MessageSquare}
          label="Community"
          value={String(newPostsCount)}
          sublabel="Neue Beiträge"
          onClick={() => onNavigate('/community')}
        />
      </div>

      {/* Quick Actions + Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-400 mb-5">Schnellaktionen</h3>
          <div className="space-y-2">
            <QuickAction
              icon={activeEntry ? Square : Play}
              label={activeEntry ? 'Gehen' : 'Kommen'}
              desc={activeEntry ? 'Zeiterfassung beenden' : 'Zeiterfassung starten'}
              onClick={() => onNavigate('/time-tracking')}
              highlight={!!activeEntry}
            />
            <QuickAction
              icon={Palmtree}
              label="Urlaubsantrag"
              desc="Neuen Antrag stellen"
              onClick={() => onNavigate('/leave')}
            />
            <QuickAction
              icon={MessageSquare}
              label="Beitrag erstellen"
              desc="In der Community posten"
              onClick={() => onNavigate('/community')}
            />
            <QuickAction
              icon={Zap}
              label="KI-Assistent"
              desc="Chat mit dem KI-Assistenten"
              onClick={() => onNavigate('/ai')}
            />
          </div>
        </div>

        {/* Open Tasks */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-400">Meine Aufgaben</h3>
            <button onClick={() => onNavigate('/tasks')} className="text-xs font-semibold text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200">
              Alle anzeigen →
            </button>
          </div>
          {!tasksData?.data?.length ? (
            <div className="flex items-center justify-center h-40 text-neutral-300 dark:text-neutral-600">
              <p className="text-sm">Keine offenen Aufgaben</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tasksData.data.slice(0, 5).map((task) => (
                <button
                  key={task.id}
                  onClick={() => onNavigate('/tasks')}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors text-left"
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    task.priority === 'urgent' ? 'bg-red-500' :
                    task.priority === 'high' ? 'bg-orange-500' :
                    task.priority === 'medium' ? 'bg-amber-500' :
                    'bg-neutral-300'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-neutral-700 dark:text-neutral-200 truncate">{task.title}</div>
                    {task.dueDate && (
                      <div className="text-xs text-neutral-400">Fällig: {new Date(task.dueDate).toLocaleDateString('de-AT')}</div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Community Activities */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-400">Letzte Community-Aktivitäten</h3>
          <button onClick={() => onNavigate('/community')} className="text-xs font-semibold text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200">
            Zur Community →
          </button>
        </div>
        {!feedData?.data?.length ? (
          <div className="flex items-center justify-center h-32 text-neutral-300 dark:text-neutral-600">
            <p className="text-sm">Noch keine Beiträge</p>
          </div>
        ) : (
          <div className="space-y-3">
            {feedData.data.slice(0, 5).map((post) => (
              <button
                key={post.id}
                onClick={() => onNavigate('/community')}
                className="w-full flex gap-3 p-3 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {post.authorAvatarUrl ? (
                    <img src={resolveImageUrl(post.authorAvatarUrl)} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-neutral-500">
                      {post.authorFirstName?.[0]}{post.authorLastName?.[0]}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">
                      {post.authorFirstName} {post.authorLastName}
                    </span>
                    <span className="text-xs text-neutral-400">· {getTimeAgo(post.createdAt)}</span>
                  </div>
                  <p className="text-sm text-neutral-600 dark:text-neutral-300 line-clamp-2">{post.content}</p>
                  {(post.totalReactions > 0 || post.commentCount > 0) && (
                    <div className="flex items-center gap-3 mt-1 text-xs text-neutral-400">
                      {post.totalReactions > 0 && <span>{post.totalReactions} Reaktionen</span>}
                      {post.commentCount > 0 && <span>{post.commentCount} Kommentare</span>}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Admin section */}
      {isAdmin && (
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp size={18} className="text-neutral-400" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-400">Übersicht</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button onClick={() => onNavigate('/admin/users')} className="bg-neutral-50 dark:bg-neutral-800 rounded-xl p-5 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors text-left">
              <div className="text-3xl font-bold text-neutral-900 dark:text-white">→</div>
              <div className="text-sm text-neutral-400 mt-1">Benutzerverwaltung</div>
            </button>
            <button onClick={() => onNavigate('/admin/organization')} className="bg-neutral-50 dark:bg-neutral-800 rounded-xl p-5 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors text-left">
              <div className="text-3xl font-bold text-neutral-900 dark:text-white">→</div>
              <div className="text-sm text-neutral-400 mt-1">Organisation</div>
            </button>
            <button onClick={() => onNavigate('/admin/settings')} className="bg-neutral-50 dark:bg-neutral-800 rounded-xl p-5 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors text-left">
              <div className="text-3xl font-bold text-neutral-900 dark:text-white">→</div>
              <div className="text-sm text-neutral-400 mt-1">Einstellungen</div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sublabel, accent, onClick, active }: {
  icon: any; label: string; value: string; sublabel: string; accent?: boolean; onClick?: () => void; active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`card p-5 text-left transition-all hover:shadow-elevated hover:-translate-y-0.5 ${active ? 'ring-2 ring-offset-2 ring-emerald-500' : ''}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center ${accent ? '' : 'bg-neutral-50 dark:bg-neutral-800'}`}
          style={accent ? { backgroundColor: 'var(--color-accent)', opacity: 0.15 } : undefined}
        >
          <Icon size={20} className="text-neutral-500" style={accent ? { color: 'var(--color-accent)' } : undefined} strokeWidth={1.5} />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{label}</span>
      </div>
      <div className="text-3xl font-bold text-neutral-900 dark:text-white tracking-tight">{value}</div>
      <div className="text-sm text-neutral-400 mt-1">{sublabel}</div>
    </button>
  );
}

function QuickAction({ icon: Icon, label, desc, onClick, highlight }: {
  icon: any; label: string; desc: string; onClick: () => void; highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-4 p-3.5 rounded-xl transition-colors text-left group ${
        highlight
          ? 'bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30'
          : 'hover:bg-neutral-50 dark:hover:bg-neutral-800'
      }`}
    >
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
        highlight
          ? 'bg-emerald-500 text-white'
          : 'bg-neutral-100 dark:bg-neutral-800 group-hover:bg-neutral-900 group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-neutral-900'
      }`}>
        <Icon size={18} strokeWidth={1.5} />
      </div>
      <div className="flex-1">
        <div className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">{label}</div>
        <div className="text-xs text-neutral-400">{desc}</div>
      </div>
      <ArrowRight size={16} className="text-neutral-300 group-hover:text-neutral-500 transition-colors" />
    </button>
  );
}
