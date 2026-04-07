import { useAuthStore } from '../../stores/auth.store';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../lib/api';
import {
  Users,
  Clock,
  Palmtree,
  CheckSquare,
  MessageSquare,
  TrendingUp,
} from 'lucide-react';
import { ROLE_HIERARCHY, type Role } from '@company-hub/shared';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const isAdmin = ROLE_HIERARCHY[(user?.role as Role) || 'user'] >= ROLE_HIERARCHY.admin;

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="card p-6">
        <h2 className="text-xl font-semibold text-slate-800">
          Willkommen, {user?.firstName}!
        </h2>
        <p className="text-slate-500 mt-1">
          Hier ist Ihre Übersicht für heute.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Clock}
          label="Arbeitszeit heute"
          value="--:--"
          subtext="Noch nicht gestempelt"
          color="primary"
        />
        <StatCard
          icon={Palmtree}
          label="Resturlaub"
          value={`${user?.vacationDaysPerYear || 25} Tage`}
          subtext="Verfügbar"
          color="emerald"
        />
        <StatCard
          icon={CheckSquare}
          label="Offene Aufgaben"
          value="--"
          subtext="Modul kommt in Phase 3"
          color="amber"
        />
        <StatCard
          icon={MessageSquare}
          label="Neue Beiträge"
          value="--"
          subtext="Modul kommt in Phase 3"
          color="blue"
        />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 mb-4">Schnellaktionen</h3>
          <div className="space-y-2">
            <QuickAction label="Kommen stempeln" description="Zeiterfassung starten" icon={Clock} />
            <QuickAction label="Urlaubsantrag stellen" description="Neuen Antrag erstellen" icon={Palmtree} />
            <QuickAction label="Beitrag verfassen" description="In der Community posten" icon={MessageSquare} />
          </div>
        </div>

        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 mb-4">Letzte Aktivitäten</h3>
          <div className="flex items-center justify-center h-32 text-slate-400 text-sm">
            Noch keine Aktivitäten vorhanden
          </div>
        </div>
      </div>

      {/* Admin stats */}
      {isAdmin && (
        <div className="card p-6">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-primary" />
            Admin-Übersicht
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-surface-secondary rounded-lg p-4">
              <div className="text-sm text-slate-500">Benutzer gesamt</div>
              <div className="text-2xl font-bold text-slate-800 mt-1">--</div>
            </div>
            <div className="bg-surface-secondary rounded-lg p-4">
              <div className="text-sm text-slate-500">Aktive heute</div>
              <div className="text-2xl font-bold text-slate-800 mt-1">--</div>
            </div>
            <div className="bg-surface-secondary rounded-lg p-4">
              <div className="text-sm text-slate-500">Offene Anträge</div>
              <div className="text-2xl font-bold text-slate-800 mt-1">--</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  color,
}: {
  icon: any;
  label: string;
  value: string;
  subtext: string;
  color: string;
}) {
  const colors: Record<string, string> = {
    primary: 'bg-primary-50 text-primary',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    blue: 'bg-blue-50 text-blue-600',
  };

  return (
    <div className="card p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon size={20} />
        </div>
        <span className="text-sm text-slate-500">{label}</span>
      </div>
      <div className="text-2xl font-bold text-slate-800">{value}</div>
      <div className="text-xs text-slate-400 mt-1">{subtext}</div>
    </div>
  );
}

function QuickAction({
  label,
  description,
  icon: Icon,
}: {
  label: string;
  description: string;
  icon: any;
}) {
  return (
    <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-surface-secondary transition-colors text-left">
      <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center text-primary flex-shrink-0">
        <Icon size={18} />
      </div>
      <div>
        <div className="text-sm font-medium text-slate-700">{label}</div>
        <div className="text-xs text-slate-400">{description}</div>
      </div>
    </button>
  );
}
