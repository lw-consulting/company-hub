import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '../../lib/api';
import { Clock, Play, Square, Coffee, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';

interface TimeEntry {
  id: string;
  clockIn: string;
  clockOut: string | null;
  breakMinutes: number;
  autoBreakApplied: boolean;
  notes: string | null;
  durationMinutes: number | null;
  netMinutes: number | null;
}

interface Summary {
  totalHours: number;
  totalMinutes: number;
  totalBreakMinutes: number;
  daysWorked: number;
  targetHours: number;
  balanceHours: number;
  dailyTargetHours: number;
  weeklyTargetHours: number;
  entries: TimeEntry[];
}

function formatTime(isoStr: string) {
  return new Date(isoStr).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(minutes: number | null) {
  if (minutes === null) return '--:--';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h}:${m.toString().padStart(2, '0')}`;
}

function getWeekRange(offset: number) {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1) + offset * 7;
  const monday = new Date(now.setDate(diff));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0],
    label: `${monday.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit' })} - ${sunday.toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' })}`,
  };
}

export default function TimeTrackingPage() {
  const queryClient = useQueryClient();
  const [weekOffset, setWeekOffset] = useState(0);
  const week = getWeekRange(weekOffset);

  // Active entry (am I clocked in?)
  const { data: activeEntry } = useQuery({
    queryKey: ['time-active'],
    queryFn: () => apiGet<TimeEntry | null>('/time-tracking/active'),
    refetchInterval: 30_000,
  });

  // Weekly summary
  const { data: summary, isLoading } = useQuery({
    queryKey: ['time-summary', week.start, week.end],
    queryFn: () => apiGet<Summary>(`/time-tracking/summary?start=${week.start}&end=${week.end}`),
  });

  const clockInMutation = useMutation({
    mutationFn: () => apiPost('/time-tracking/clock-in'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-active'] });
      queryClient.invalidateQueries({ queryKey: ['time-summary'] });
    },
  });

  const clockOutMutation = useMutation({
    mutationFn: () => apiPost('/time-tracking/clock-out'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-active'] });
      queryClient.invalidateQueries({ queryKey: ['time-summary'] });
    },
  });

  const isClockedIn = !!activeEntry;
  const balance = summary?.balanceHours || 0;

  return (
    <div className="space-y-6">
      {/* Clock In/Out Card */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="flex-1 text-center sm:text-left">
            <h2 className="text-lg font-semibold text-neutral-800">Zeiterfassung</h2>
            {isClockedIn ? (
              <div>
                <p className="text-neutral-500 mt-1">
                  Eingestempelt seit <span className="font-medium text-primary">{formatTime(activeEntry.clockIn)}</span>
                </p>
                <LiveTimer clockIn={activeEntry.clockIn} />
              </div>
            ) : (
              <p className="text-neutral-500 mt-1">Noch nicht eingestempelt</p>
            )}
          </div>

          <button
            onClick={() => isClockedIn ? clockOutMutation.mutate() : clockInMutation.mutate()}
            disabled={clockInMutation.isPending || clockOutMutation.isPending}
            className={`flex items-center gap-3 px-8 py-4 rounded-xl text-lg font-semibold transition-all ${
              isClockedIn
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-primary hover:bg-primary-dark text-white'
            } disabled:opacity-50`}
          >
            {isClockedIn ? (
              <>
                <Square size={24} />
                Ausstempeln
              </>
            ) : (
              <>
                <Play size={24} />
                Einstempeln
              </>
            )}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-sm text-neutral-500">Stunden diese Woche</div>
          <div className="text-2xl font-bold text-neutral-800 mt-1">
            {summary ? formatDuration(summary.totalMinutes) : '--:--'}
          </div>
          <div className="text-xs text-neutral-400">Soll: {summary?.weeklyTargetHours || 40}h</div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-neutral-500">Saldo</div>
          <div className={`text-2xl font-bold mt-1 ${balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {balance >= 0 ? '+' : ''}{balance.toFixed(1)}h
          </div>
          <div className="text-xs text-neutral-400">Mehr-/Minderstunden</div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-neutral-500">Arbeitstage</div>
          <div className="text-2xl font-bold text-neutral-800 mt-1">{summary?.daysWorked || 0}</div>
          <div className="text-xs text-neutral-400">diese Woche</div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-neutral-500">Pausen</div>
          <div className="text-2xl font-bold text-neutral-800 mt-1">
            {summary ? `${summary.totalBreakMinutes} min` : '--'}
          </div>
          <div className="text-xs text-neutral-400">gesamt</div>
        </div>
      </div>

      {/* Week Navigation + Entries */}
      <div className="card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-light">
          <button onClick={() => setWeekOffset(weekOffset - 1)} className="btn-ghost p-2">
            <ChevronLeft size={18} />
          </button>
          <span className="font-medium text-neutral-700">{week.label}</span>
          <div className="flex items-center gap-2">
            {weekOffset !== 0 && (
              <button onClick={() => setWeekOffset(0)} className="text-xs text-primary font-medium hover:underline">
                Heute
              </button>
            )}
            <button onClick={() => setWeekOffset(weekOffset + 1)} className="btn-ghost p-2">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-secondary">
                <th className="text-left text-xs font-semibold text-neutral-500 uppercase px-6 py-3">Datum</th>
                <th className="text-left text-xs font-semibold text-neutral-500 uppercase px-6 py-3">Kommen</th>
                <th className="text-left text-xs font-semibold text-neutral-500 uppercase px-6 py-3">Gehen</th>
                <th className="text-left text-xs font-semibold text-neutral-500 uppercase px-6 py-3">Pause</th>
                <th className="text-left text-xs font-semibold text-neutral-500 uppercase px-6 py-3">Netto</th>
                <th className="text-left text-xs font-semibold text-neutral-500 uppercase px-6 py-3">Notiz</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {isLoading ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-neutral-400">Laden...</td></tr>
              ) : !summary?.entries?.length ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-neutral-400">Keine Einträge in dieser Woche</td></tr>
              ) : (
                summary.entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-surface-secondary/50">
                    <td className="px-6 py-3 text-sm font-medium text-neutral-700">
                      {new Date(entry.clockIn).toLocaleDateString('de-AT', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                    </td>
                    <td className="px-6 py-3 text-sm text-neutral-600">{formatTime(entry.clockIn)}</td>
                    <td className="px-6 py-3 text-sm text-neutral-600">
                      {entry.clockOut ? formatTime(entry.clockOut) : (
                        <span className="badge-success">Aktiv</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-sm text-neutral-600">
                      {entry.breakMinutes} min
                      {entry.autoBreakApplied && (
                        <span title="Automatische Pause"><Coffee size={14} className="inline ml-1 text-amber-500" /></span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-sm font-medium text-neutral-700">
                      {formatDuration(entry.netMinutes)}
                    </td>
                    <td className="px-6 py-3 text-sm text-neutral-400 max-w-[150px] truncate">
                      {entry.notes || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/** Live counter showing elapsed time since clock-in */
function LiveTimer({ clockIn }: { clockIn: string }) {
  const [tick, setTick] = useState(0);

  // Re-render every minute
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  const elapsed = Math.floor((Date.now() - new Date(clockIn).getTime()) / 60000);
  return (
    <div className="text-3xl font-bold text-primary mt-2">
      {formatDuration(elapsed)}
    </div>
  );
}
