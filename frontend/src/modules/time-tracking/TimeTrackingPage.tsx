import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch } from '../../lib/api';
import { Clock, Play, Square, Coffee, ChevronLeft, ChevronRight, Edit, X, Check, AlertCircle } from 'lucide-react';

interface TimeEntry {
  id: string;
  clockIn: string;
  clockOut: string | null;
  breakMinutes: number;
  autoBreakApplied: boolean;
  notes: string | null;
  durationMinutes: number | null;
  netMinutes: number | null;
  userEdited?: boolean;
  userEditedAt?: string | null;
  correctedBy?: string | null;
}

interface Summary {
  totalHours: number;
  totalMinutes: number;
  totalBreakMinutes: number;
  daysWorked: number;
  targetHours: number;
  balanceHours: number;
  initialBalanceMinutes: number;
  initialBalanceHours: number;
  dailyTargetHours: number;
  weeklyTargetHours: number;
  workingDays: number[];
  entries: TimeEntry[];
}

function formatTime(isoStr: string) {
  return new Date(isoStr).toLocaleTimeString('de-AT', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(minutes: number | null) {
  if (minutes === null) return '--:--';
  const negative = minutes < 0;
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = Math.round(abs % 60);
  return `${negative ? '-' : ''}${h}:${m.toString().padStart(2, '0')}`;
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
  const [showPauseModal, setShowPauseModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimeEntry | null>(null);
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
  const cumulativeBalance = balance + (summary?.initialBalanceHours || 0);

  return (
    <div className="space-y-6">
      {/* Clock In/Out Card */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="flex-1 text-center sm:text-left">
            <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">Zeiterfassung</h2>
            {isClockedIn ? (
              <div>
                <p className="text-neutral-500 mt-1">
                  Gekommen um <span className="font-medium text-primary">{formatTime(activeEntry.clockIn)}</span>
                  {activeEntry.breakMinutes > 0 && (
                    <span className="ml-2 text-neutral-400">· Pause: {activeEntry.breakMinutes} min</span>
                  )}
                </p>
                <LiveTimer clockIn={activeEntry.clockIn} breakMinutes={activeEntry.breakMinutes} />
              </div>
            ) : (
              <p className="text-neutral-500 mt-1">Noch nicht gekommen</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isClockedIn && (
              <button
                onClick={() => setShowPauseModal(true)}
                className="flex items-center gap-2 px-5 py-4 rounded-xl font-semibold bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 dark:text-amber-300 transition-all"
              >
                <Coffee size={20} />
                Pause
              </button>
            )}
            <button
              onClick={() => isClockedIn ? clockOutMutation.mutate() : clockInMutation.mutate()}
              disabled={clockInMutation.isPending || clockOutMutation.isPending}
              className={`flex items-center gap-3 px-8 py-4 rounded-xl text-lg font-semibold transition-all ${
                isClockedIn
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'text-white'
              } disabled:opacity-50`}
              style={!isClockedIn ? { backgroundColor: 'var(--color-primary)' } : undefined}
            >
              {isClockedIn ? (
                <>
                  <Square size={24} />
                  Gehen
                </>
              ) : (
                <>
                  <Play size={24} />
                  Kommen
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-sm text-neutral-500">Stunden diese Woche</div>
          <div className="text-2xl font-bold text-neutral-800 dark:text-neutral-100 mt-1">
            {summary ? formatDuration(summary.totalMinutes) : '--:--'}
          </div>
          <div className="text-xs text-neutral-400">Soll: {summary?.targetHours?.toFixed(1) || '--'}h</div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-neutral-500">Saldo (Woche)</div>
          <div className={`text-2xl font-bold mt-1 ${balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {balance >= 0 ? '+' : ''}{balance.toFixed(1)}h
          </div>
          <div className="text-xs text-neutral-400">Mehr-/Minderstunden</div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-neutral-500">Saldo gesamt</div>
          <div className={`text-2xl font-bold mt-1 ${cumulativeBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {cumulativeBalance >= 0 ? '+' : ''}{cumulativeBalance.toFixed(1)}h
          </div>
          <div className="text-xs text-neutral-400">inkl. Übertrag</div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-neutral-500">Pausen</div>
          <div className="text-2xl font-bold text-neutral-800 dark:text-neutral-100 mt-1">
            {summary ? `${summary.totalBreakMinutes} min` : '--'}
          </div>
          <div className="text-xs text-neutral-400">gesamt</div>
        </div>
      </div>

      {/* Week Navigation + Entries */}
      <div className="card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-neutral-800">
          <button onClick={() => setWeekOffset(weekOffset - 1)} className="btn-ghost p-2">
            <ChevronLeft size={18} />
          </button>
          <span className="font-medium text-neutral-700 dark:text-neutral-200">{week.label}</span>
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
              <tr className="bg-neutral-50 dark:bg-neutral-800/50">
                <th className="text-left text-xs font-semibold text-neutral-500 uppercase px-6 py-3">Datum</th>
                <th className="text-left text-xs font-semibold text-neutral-500 uppercase px-6 py-3">Kommen</th>
                <th className="text-left text-xs font-semibold text-neutral-500 uppercase px-6 py-3">Gehen</th>
                <th className="text-left text-xs font-semibold text-neutral-500 uppercase px-6 py-3">Pause</th>
                <th className="text-left text-xs font-semibold text-neutral-500 uppercase px-6 py-3">Netto</th>
                <th className="text-left text-xs font-semibold text-neutral-500 uppercase px-6 py-3">Notiz</th>
                <th className="text-right text-xs font-semibold text-neutral-500 uppercase px-6 py-3">Aktion</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {isLoading ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-neutral-400">Laden...</td></tr>
              ) : !summary?.entries?.length ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-neutral-400">Keine Einträge in dieser Woche</td></tr>
              ) : (
                summary.entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30">
                    <td className="px-6 py-3 text-sm font-medium text-neutral-700 dark:text-neutral-200">
                      <div className="flex items-center gap-2">
                        {new Date(entry.clockIn).toLocaleDateString('de-AT', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                        {entry.userEdited && (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded"
                            title={`Bearbeitet${entry.userEditedAt ? ' am ' + new Date(entry.userEditedAt).toLocaleString('de-AT') : ''}`}
                          >
                            <Edit size={9} /> bearbeitet
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-sm text-neutral-600 dark:text-neutral-300">{formatTime(entry.clockIn)}</td>
                    <td className="px-6 py-3 text-sm text-neutral-600 dark:text-neutral-300">
                      {entry.clockOut ? formatTime(entry.clockOut) : (
                        <span className="badge-success">Aktiv</span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-sm text-neutral-600 dark:text-neutral-300">
                      {entry.breakMinutes} min
                      {entry.autoBreakApplied && (
                        <span title="Automatische Pause"><Coffee size={14} className="inline ml-1 text-amber-500" /></span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-sm font-medium text-neutral-700 dark:text-neutral-200">
                      {formatDuration(entry.netMinutes)}
                    </td>
                    <td className="px-6 py-3 text-sm text-neutral-400 max-w-[150px] truncate">
                      {entry.notes || '-'}
                    </td>
                    <td className="px-6 py-3 text-right">
                      {entry.clockOut && (
                        <button
                          onClick={() => setEditingEntry(entry)}
                          className="p-1.5 rounded-lg text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-600 transition-colors"
                          title="Bearbeiten"
                        >
                          <Edit size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pause Modal */}
      {showPauseModal && <PauseModal onClose={() => setShowPauseModal(false)} />}

      {/* Edit Entry Modal */}
      {editingEntry && <EditEntryModal entry={editingEntry} onClose={() => setEditingEntry(null)} />}
    </div>
  );
}

/** Live counter showing elapsed work time minus breaks */
function LiveTimer({ clockIn, breakMinutes }: { clockIn: string; breakMinutes: number }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  const elapsed = Math.floor((Date.now() - new Date(clockIn).getTime()) / 60000);
  const net = Math.max(0, elapsed - breakMinutes);
  return (
    <div className="text-3xl font-bold text-primary mt-2">
      {formatDuration(net)}
    </div>
  );
}

/** Modal to add a break */
function PauseModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [minutes, setMinutes] = useState('30');
  const [error, setError] = useState('');

  const addBreakMut = useMutation({
    mutationFn: (m: number) => apiPost('/time-tracking/break', { minutes: m }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-active'] });
      queryClient.invalidateQueries({ queryKey: ['time-summary'] });
      onClose();
    },
    onError: (e: any) => setError(e?.message || 'Fehler beim Hinzufügen der Pause'),
  });

  const handleSubmit = () => {
    const m = parseInt(minutes, 10);
    if (isNaN(m) || m <= 0) {
      setError('Bitte eine gültige Anzahl Minuten eingeben');
      return;
    }
    setError('');
    addBreakMut.mutate(m);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="card w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100 flex items-center gap-2">
            <Coffee size={20} className="text-amber-500" /> Pause buchen
          </h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-neutral-500">Wie viele Minuten Pause möchtest du buchen?</p>
        <div>
          <label className="label">Pausendauer (Minuten)</label>
          <input
            type="number"
            min="1"
            className="input"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            autoFocus
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {[15, 30, 45, 60].map((preset) => (
            <button
              key={preset}
              onClick={() => setMinutes(String(preset))}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
            >
              {preset} min
            </button>
          ))}
        </div>
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-2.5 rounded-lg">
            <AlertCircle size={14} /> {error}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Abbrechen</button>
          <button onClick={handleSubmit} className="btn-primary" disabled={addBreakMut.isPending}>
            {addBreakMut.isPending ? 'Speichern...' : <><Check size={16} /> Pause hinzufügen</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Modal to edit an existing time entry */
function EditEntryModal({ entry, onClose }: { entry: TimeEntry; onClose: () => void }) {
  const queryClient = useQueryClient();

  // Format ISO to local "HH:mm" for input[type=time]
  const toTimeInput = (iso: string) => {
    const d = new Date(iso);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };
  const dateStr = new Date(entry.clockIn).toISOString().split('T')[0];

  const [clockInTime, setClockInTime] = useState(toTimeInput(entry.clockIn));
  const [clockOutTime, setClockOutTime] = useState(entry.clockOut ? toTimeInput(entry.clockOut) : '');
  const [breakMinutes, setBreakMinutes] = useState(String(entry.breakMinutes));
  const [notes, setNotes] = useState(entry.notes || '');
  const [error, setError] = useState('');

  const updateMut = useMutation({
    mutationFn: (data: any) => apiPatch(`/time-tracking/entries/${entry.id}/own`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['time-summary'] });
      queryClient.invalidateQueries({ queryKey: ['time-active'] });
      onClose();
    },
    onError: (e: any) => setError(e?.message || 'Fehler beim Speichern'),
  });

  const handleSubmit = () => {
    setError('');
    const [inH, inM] = clockInTime.split(':').map(Number);
    const [outH, outM] = clockOutTime.split(':').map(Number);
    const inIso = new Date(`${dateStr}T${clockInTime}:00`).toISOString();
    const outIso = new Date(`${dateStr}T${clockOutTime}:00`).toISOString();

    if (outH < inH || (outH === inH && outM < inM)) {
      setError('Gehen muss nach Kommen liegen');
      return;
    }
    const bm = parseInt(breakMinutes, 10);
    if (isNaN(bm) || bm < 0) {
      setError('Pause muss eine positive Zahl sein');
      return;
    }

    updateMut.mutate({
      clockIn: inIso,
      clockOut: outIso,
      breakMinutes: bm,
      notes: notes || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="card w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100 flex items-center gap-2">
            <Edit size={18} /> Zeiteintrag bearbeiten
          </h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            <X size={20} />
          </button>
        </div>

        <div className="text-sm text-neutral-500">
          {new Date(entry.clockIn).toLocaleDateString('de-AT', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Kommen</label>
            <input type="time" className="input" value={clockInTime} onChange={(e) => setClockInTime(e.target.value)} />
          </div>
          <div>
            <label className="label">Gehen</label>
            <input type="time" className="input" value={clockOutTime} onChange={(e) => setClockOutTime(e.target.value)} />
          </div>
        </div>

        <div>
          <label className="label">Pause (Minuten)</label>
          <input type="number" min="0" className="input" value={breakMinutes} onChange={(e) => setBreakMinutes(e.target.value)} />
        </div>

        <div>
          <label className="label">Notiz</label>
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
        </div>

        <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-300">
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
          <span>Dieser Eintrag wird als <strong>"bearbeitet"</strong> markiert und ist für deinen Vorgesetzten sichtbar.</span>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 p-2.5 rounded-lg">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Abbrechen</button>
          <button onClick={handleSubmit} className="btn-primary" disabled={updateMut.isPending}>
            {updateMut.isPending ? 'Speichern...' : <><Check size={16} /> Speichern</>}
          </button>
        </div>
      </div>
    </div>
  );
}
