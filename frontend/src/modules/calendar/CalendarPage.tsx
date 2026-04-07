import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost } from '../../lib/api';
import { ChevronLeft, ChevronRight, Plus, X, Users, User } from 'lucide-react';

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  color: string | null;
  visibility: string;
  sourceType: string;
  creatorFirstName: string;
  creatorLastName: string;
}

const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTH_NAMES = [
  'Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

function getMonthDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7; // Monday=0
  const days: { date: Date; isCurrentMonth: boolean }[] = [];

  // Fill previous month
  for (let i = startOffset - 1; i >= 0; i--) {
    const d = new Date(year, month, -i);
    days.push({ date: d, isCurrentMonth: false });
  }

  // Current month
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push({ date: new Date(year, month, d), isCurrentMonth: true });
  }

  // Fill next month to complete grid
  while (days.length % 7 !== 0) {
    const d = new Date(year, month + 1, days.length - startOffset - lastDay.getDate() + 1);
    days.push({ date: d, isCurrentMonth: false });
  }

  return days;
}

export default function CalendarPage() {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'personal' | 'team'>('personal');
  const [showForm, setShowForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const days = getMonthDays(year, month);

  const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const monthEnd = `${year}-${String(month + 1).padStart(2, '0')}-${new Date(year, month + 1, 0).getDate()}`;

  const { data: events } = useQuery({
    queryKey: ['calendar-events', monthStart, monthEnd, view],
    queryFn: () =>
      view === 'team'
        ? apiGet<CalendarEvent[]>(`/calendar/team-absences?start=${monthStart}&end=${monthEnd}`)
        : apiGet<CalendarEvent[]>(`/calendar/events?start=${monthStart}&end=${monthEnd}`),
  });

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  const today = new Date().toISOString().split('T')[0];

  function getEventsForDate(date: Date): CalendarEvent[] {
    if (!events) return [];
    const dateStr = date.toISOString().split('T')[0];
    return events.filter((e) => {
      const start = e.startAt.split('T')[0];
      const end = e.endAt.split('T')[0];
      return dateStr >= start && dateStr <= end;
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <button onClick={prevMonth} className="btn-ghost p-2"><ChevronLeft size={18} /></button>
            <h2 className="text-lg font-semibold text-neutral-800 min-w-[180px] text-center">
              {MONTH_NAMES[month]} {year}
            </h2>
            <button onClick={nextMonth} className="btn-ghost p-2"><ChevronRight size={18} /></button>
          </div>
          <button onClick={goToday} className="text-sm text-primary font-medium hover:underline">Heute</button>
        </div>

        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex bg-surface-tertiary rounded-lg p-0.5">
            <button
              onClick={() => setView('personal')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                view === 'personal' ? 'bg-white shadow-sm text-neutral-800' : 'text-neutral-500'
              }`}
            >
              <User size={14} /> Persönlich
            </button>
            <button
              onClick={() => setView('team')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                view === 'team' ? 'bg-white shadow-sm text-neutral-800' : 'text-neutral-500'
              }`}
            >
              <Users size={14} /> Team
            </button>
          </div>

          {view === 'personal' && (
            <button onClick={() => setShowForm(true)} className="btn-primary">
              <Plus size={18} /> Termin
            </button>
          )}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="card overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 bg-surface-secondary border-b border-border">
          {WEEKDAYS.map((d) => (
            <div key={d} className="text-center text-xs font-semibold text-neutral-500 uppercase py-3">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {days.map(({ date, isCurrentMonth }, idx) => {
            const dateStr = date.toISOString().split('T')[0];
            const isToday = dateStr === today;
            const dayEvents = getEventsForDate(date);

            return (
              <div
                key={idx}
                className={`min-h-[100px] border-b border-r border-border-light p-1.5 ${
                  !isCurrentMonth ? 'bg-surface-secondary/50' : 'bg-white'
                }`}
              >
                <div
                  className={`text-sm font-medium mb-1 w-7 h-7 flex items-center justify-center rounded-full ${
                    isToday
                      ? 'bg-primary text-white'
                      : isCurrentMonth
                        ? 'text-neutral-700'
                        : 'text-neutral-300'
                  }`}
                >
                  {date.getDate()}
                </div>

                <div className="space-y-0.5">
                  {dayEvents.slice(0, 3).map((evt) => (
                    <div
                      key={evt.id}
                      className="text-[11px] px-1.5 py-0.5 rounded truncate text-white font-medium"
                      style={{ backgroundColor: evt.color || '#6366f1' }}
                      title={evt.title}
                    >
                      {evt.title}
                    </div>
                  ))}
                  {dayEvents.length > 3 && (
                    <div className="text-[10px] text-neutral-400 px-1.5">
                      +{dayEvents.length - 3} mehr
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Create Event Modal */}
      {showForm && <CreateEventModal onClose={() => setShowForm(false)} />}
    </div>
  );
}

function CreateEventModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    title: '',
    description: '',
    startAt: '',
    endAt: '',
    allDay: false,
    visibility: 'private',
    color: '#6366f1',
  });
  const [error, setError] = useState('');

  const createMutation = useMutation({
    mutationFn: (data: any) => apiPost('/calendar/events', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      onClose();
    },
    onError: (err: any) => setError(err?.message || 'Fehler'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      ...form,
      description: form.description || undefined,
      startAt: form.allDay ? form.startAt + 'T00:00:00' : form.startAt,
      endAt: form.allDay ? form.endAt + 'T23:59:59' : form.endAt,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-neutral-800">Neuer Termin</h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600"><X size={20} /></button>
        </div>

        {error && <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Titel</label>
            <input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>

          <label className="flex items-center gap-2 text-sm text-neutral-600">
            <input type="checkbox" checked={form.allDay} onChange={(e) => setForm({ ...form, allDay: e.target.checked })} />
            Ganztägig
          </label>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Start</label>
              <input
                type={form.allDay ? 'date' : 'datetime-local'}
                className="input"
                required
                value={form.startAt}
                onChange={(e) => setForm({ ...form, startAt: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Ende</label>
              <input
                type={form.allDay ? 'date' : 'datetime-local'}
                className="input"
                required
                value={form.endAt}
                onChange={(e) => setForm({ ...form, endAt: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="label">Beschreibung</label>
            <textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Sichtbarkeit</label>
              <select className="input" value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })}>
                <option value="private">Privat</option>
                <option value="team">Team</option>
                <option value="org">Alle</option>
              </select>
            </div>
            <div>
              <label className="label">Farbe</label>
              <input type="color" className="w-full h-10 rounded cursor-pointer border border-border" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Abbrechen</button>
            <button type="submit" className="btn-primary" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Erstelle...' : 'Erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
