import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch } from '../../lib/api';
import { useAuthStore } from '../../stores/auth.store';
import { ROLE_HIERARCHY, type Role } from '@company-hub/shared';
import { Palmtree, Plus, CheckCircle, XCircle, Clock, X, CalendarDays } from 'lucide-react';

interface LeaveBalance {
  totalDays: number;
  usedDays: number;
  pendingDays: number;
  remainingDays: number;
  availableDays: number;
  year: number;
}

interface LeaveType {
  id: string;
  name: string;
  color: string;
  deductsVacation: boolean;
  requiresApproval: boolean;
}

interface LeaveRequest {
  id: string;
  startDate: string;
  endDate: string;
  businessDays: number;
  reason: string | null;
  status: string;
  decisionNote: string | null;
  decidedAt: string | null;
  createdAt: string;
  leaveTypeName: string;
  leaveTypeColor: string;
  // For pending (supervisor view)
  userId?: string;
  employeeFirstName?: string;
  employeeLastName?: string;
}

const STATUS_CONFIG: Record<string, { label: string; class: string; icon: any }> = {
  pending: { label: 'Ausstehend', class: 'badge-warning', icon: Clock },
  approved: { label: 'Genehmigt', class: 'badge-success', icon: CheckCircle },
  rejected: { label: 'Abgelehnt', class: 'badge-danger', icon: XCircle },
  cancelled: { label: 'Storniert', class: 'badge bg-neutral-100 text-neutral-500', icon: XCircle },
};

export default function LeavePage() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const isManager = ROLE_HIERARCHY[(user?.role as Role) || 'user'] >= ROLE_HIERARCHY.manager;

  const { data: balance } = useQuery({
    queryKey: ['leave-balance'],
    queryFn: () => apiGet<LeaveBalance>('/leave/balance'),
  });

  const { data: requests } = useQuery({
    queryKey: ['leave-requests'],
    queryFn: () => apiGet<LeaveRequest[]>('/leave/requests'),
  });

  const { data: pendingRequests } = useQuery({
    queryKey: ['leave-pending'],
    queryFn: () => apiGet<LeaveRequest[]>('/leave/pending'),
    enabled: isManager,
  });

  return (
    <div className="space-y-6">
      {/* Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <BalanceCard label="Jahresanspruch" value={`${balance?.totalDays || 25}`} unit="Tage" color="primary" />
        <BalanceCard label="Verbraucht" value={`${balance?.usedDays || 0}`} unit="Tage" color="amber" />
        <BalanceCard label="Ausstehend" value={`${balance?.pendingDays || 0}`} unit="Tage" color="blue" />
        <BalanceCard label="Verfügbar" value={`${balance?.availableDays || balance?.totalDays || 25}`} unit="Tage" color="emerald" />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-800">Meine Anträge</h2>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          <Plus size={18} />
          Neuer Antrag
        </button>
      </div>

      {/* Requests List */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-surface-secondary border-b border-border">
                <th className="text-left text-xs font-semibold text-neutral-500 uppercase px-6 py-3">Typ</th>
                <th className="text-left text-xs font-semibold text-neutral-500 uppercase px-6 py-3">Zeitraum</th>
                <th className="text-left text-xs font-semibold text-neutral-500 uppercase px-6 py-3">Tage</th>
                <th className="text-left text-xs font-semibold text-neutral-500 uppercase px-6 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-neutral-500 uppercase px-6 py-3">Eingereicht</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {!requests?.length ? (
                <tr><td colSpan={5} className="px-6 py-8 text-center text-neutral-400">Keine Anträge vorhanden</td></tr>
              ) : (
                requests.map((req) => {
                  const config = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
                  return (
                    <tr key={req.id} className="hover:bg-surface-secondary/50">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: req.leaveTypeColor }} />
                          <span className="text-sm font-medium text-neutral-700">{req.leaveTypeName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-sm text-neutral-600">
                        {formatDate(req.startDate)} - {formatDate(req.endDate)}
                      </td>
                      <td className="px-6 py-3 text-sm font-medium text-neutral-700">{req.businessDays}</td>
                      <td className="px-6 py-3">
                        <span className={config.class}>{config.label}</span>
                      </td>
                      <td className="px-6 py-3 text-sm text-neutral-400">
                        {new Date(req.createdAt).toLocaleDateString('de-AT')}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Supervisor: Pending Approvals */}
      {isManager && pendingRequests && pendingRequests.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-neutral-800">Zu genehmigen</h2>
          <div className="space-y-3">
            {pendingRequests.map((req) => (
              <PendingApprovalCard key={req.id} request={req} />
            ))}
          </div>
        </div>
      )}

      {/* Create Form Modal */}
      {showForm && <CreateLeaveModal onClose={() => setShowForm(false)} />}
    </div>
  );
}

function BalanceCard({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  const colors: Record<string, string> = {
    primary: 'border-l-primary',
    emerald: 'border-l-emerald-500',
    amber: 'border-l-amber-500',
    blue: 'border-l-blue-500',
  };
  return (
    <div className={`card p-4 border-l-4 ${colors[color]}`}>
      <div className="text-sm text-neutral-500">{label}</div>
      <div className="flex items-baseline gap-1 mt-1">
        <span className="text-2xl font-bold text-neutral-800">{value}</span>
        <span className="text-sm text-neutral-400">{unit}</span>
      </div>
    </div>
  );
}

function PendingApprovalCard({ request }: { request: LeaveRequest }) {
  const queryClient = useQueryClient();

  const decideMutation = useMutation({
    mutationFn: ({ status, note }: { status: string; note?: string }) =>
      apiPatch(`/leave/requests/${request.id}`, { status, note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-pending'] });
    },
  });

  return (
    <div className="card p-4 flex items-center justify-between">
      <div>
        <div className="font-medium text-neutral-800">
          {request.employeeFirstName} {request.employeeLastName}
        </div>
        <div className="text-sm text-neutral-500">
          {request.leaveTypeName} &middot; {formatDate(request.startDate)} - {formatDate(request.endDate)} &middot; {request.businessDays} Tage
        </div>
        {request.reason && <div className="text-xs text-neutral-400 mt-1">{request.reason}</div>}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => decideMutation.mutate({ status: 'rejected' })}
          className="btn-ghost text-red-600 hover:bg-red-50"
          disabled={decideMutation.isPending}
        >
          <XCircle size={18} />
          Ablehnen
        </button>
        <button
          onClick={() => decideMutation.mutate({ status: 'approved' })}
          className="btn-primary"
          disabled={decideMutation.isPending}
        >
          <CheckCircle size={18} />
          Genehmigen
        </button>
      </div>
    </div>
  );
}

function CreateLeaveModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    leaveTypeId: '',
    startDate: '',
    endDate: '',
    halfDayStart: false,
    halfDayEnd: false,
    reason: '',
  });
  const [error, setError] = useState('');

  const { data: leaveTypes } = useQuery({
    queryKey: ['leave-types'],
    queryFn: () => apiGet<LeaveType[]>('/leave/types'),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiPost('/leave/requests', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['leave-balance'] });
      onClose();
    },
    onError: (err: any) => setError(err?.message || 'Fehler'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      ...form,
      reason: form.reason || undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-neutral-800">Neuer Antrag</h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600"><X size={20} /></button>
        </div>

        {error && <div className="p-3 mb-4 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Typ</label>
            <select className="input" required value={form.leaveTypeId} onChange={(e) => setForm({ ...form, leaveTypeId: e.target.value })}>
              <option value="">Bitte wählen...</option>
              {leaveTypes?.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Von</label>
              <input type="date" className="input" required value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              <label className="flex items-center gap-2 mt-1 text-xs text-neutral-500">
                <input type="checkbox" checked={form.halfDayStart} onChange={(e) => setForm({ ...form, halfDayStart: e.target.checked })} />
                Halber Tag
              </label>
            </div>
            <div>
              <label className="label">Bis</label>
              <input type="date" className="input" required value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              <label className="flex items-center gap-2 mt-1 text-xs text-neutral-500">
                <input type="checkbox" checked={form.halfDayEnd} onChange={(e) => setForm({ ...form, halfDayEnd: e.target.checked })} />
                Halber Tag
              </label>
            </div>
          </div>

          <div>
            <label className="label">Grund (optional)</label>
            <textarea className="input" rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Abbrechen</button>
            <button type="submit" className="btn-primary" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Sende...' : 'Antrag einreichen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('de-AT', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
