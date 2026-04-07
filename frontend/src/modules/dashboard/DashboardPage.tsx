import { useAuthStore } from '../../stores/auth.store';
import { ROLE_HIERARCHY, type Role } from '@company-hub/shared';
import { Clock, Palmtree, CheckSquare, MessageSquare, TrendingUp, ArrowRight, Zap } from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const isAdmin = ROLE_HIERARCHY[(user?.role as Role) || 'user'] >= ROLE_HIERARCHY.admin;

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Welcome */}
      <div>
        <h2 className="text-display text-neutral-900 dark:text-white">
          Guten Tag, {user?.firstName}
        </h2>
        <p className="text-muted mt-1 text-lg">Hier ist Ihre Übersicht für heute.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Clock} label="Arbeitszeit" value="--:--" sublabel="Heute" />
        <StatCard icon={Palmtree} label="Resturlaub" value={`${user?.vacationDaysPerYear || 25}`} sublabel="Tage verfügbar" accent />
        <StatCard icon={CheckSquare} label="Aufgaben" value="--" sublabel="Offen" />
        <StatCard icon={MessageSquare} label="Community" value="--" sublabel="Neue Beiträge" />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-400 mb-5">Schnellaktionen</h3>
          <div className="space-y-2">
            <QuickAction icon={Clock} label="Kommen stempeln" desc="Zeiterfassung starten" />
            <QuickAction icon={Palmtree} label="Urlaubsantrag" desc="Neuen Antrag stellen" />
            <QuickAction icon={MessageSquare} label="Beitrag erstellen" desc="In der Community posten" />
            <QuickAction icon={Zap} label="KI-Assistent" desc="Chat mit dem KI-Assistenten" />
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-400 mb-5">Aktivitäten</h3>
          <div className="flex items-center justify-center h-40 text-neutral-300 dark:text-neutral-600">
            <p className="text-sm">Noch keine Aktivitäten</p>
          </div>
        </div>
      </div>

      {/* Admin section */}
      {isAdmin && (
        <div className="card p-6">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp size={18} className="text-neutral-400" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-400">Übersicht</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-neutral-50 dark:bg-neutral-800 rounded-xl p-5">
              <div className="text-3xl font-bold text-neutral-900 dark:text-white">--</div>
              <div className="text-sm text-neutral-400 mt-1">Benutzer gesamt</div>
            </div>
            <div className="bg-neutral-50 dark:bg-neutral-800 rounded-xl p-5">
              <div className="text-3xl font-bold text-neutral-900 dark:text-white">--</div>
              <div className="text-sm text-neutral-400 mt-1">Aktive heute</div>
            </div>
            <div className="bg-neutral-50 dark:bg-neutral-800 rounded-xl p-5">
              <div className="text-3xl font-bold text-neutral-900 dark:text-white">--</div>
              <div className="text-sm text-neutral-400 mt-1">Offene Anträge</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sublabel, accent }: {
  icon: any; label: string; value: string; sublabel: string; accent?: boolean;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accent ? '' : 'bg-neutral-50 dark:bg-neutral-800'}`}
          style={accent ? { backgroundColor: 'var(--color-accent)', opacity: 0.15 } : undefined}>
          <Icon size={20} className="text-neutral-500" style={accent ? { color: 'var(--color-accent)' } : undefined} strokeWidth={1.5} />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{label}</span>
      </div>
      <div className="text-3xl font-bold text-neutral-900 dark:text-white tracking-tight">{value}</div>
      <div className="text-sm text-neutral-400 mt-1">{sublabel}</div>
    </div>
  );
}

function QuickAction({ icon: Icon, label, desc }: { icon: any; label: string; desc: string }) {
  return (
    <button className="w-full flex items-center gap-4 p-3.5 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors text-left group">
      <div className="w-10 h-10 rounded-xl bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center flex-shrink-0 group-hover:bg-neutral-900 group-hover:text-white dark:group-hover:bg-white dark:group-hover:text-neutral-900 transition-colors">
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
