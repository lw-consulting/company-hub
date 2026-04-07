import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete } from '../../lib/api';
import { Users, Building2, TrendingUp, Activity, Plus, X, Phone, Mail, Globe } from 'lucide-react';

const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead', qualified: 'Qualifiziert', proposal: 'Angebot',
  negotiation: 'Verhandlung', won: 'Gewonnen', lost: 'Verloren',
};
const STAGE_COLORS: Record<string, string> = {
  lead: 'bg-neutral-100 text-neutral-700', qualified: 'bg-blue-100 text-blue-700',
  proposal: 'bg-violet-100 text-violet-700', negotiation: 'bg-amber-100 text-amber-700',
  won: 'bg-emerald-100 text-emerald-700', lost: 'bg-red-100 text-red-700',
};

export default function CrmPage() {
  const [tab, setTab] = useState<'pipeline' | 'contacts' | 'companies'>('pipeline');

  return (
    <div className="space-y-6">
      <div className="flex bg-neutral-100 dark:bg-neutral-800 rounded-lg p-0.5 w-fit">
        {[
          { key: 'pipeline', label: 'Pipeline', icon: TrendingUp },
          { key: 'contacts', label: 'Kontakte', icon: Users },
          { key: 'companies', label: 'Unternehmen', icon: Building2 },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key as any)}
            className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors ${
              tab === key ? 'bg-white dark:bg-neutral-700 shadow-sm text-neutral-800 dark:text-neutral-100' : 'text-neutral-500'
            }`}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {tab === 'pipeline' && <PipelineView />}
      {tab === 'contacts' && <ContactsView />}
      {tab === 'companies' && <CompaniesView />}
    </div>
  );
}

function PipelineView() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: pipeline } = useQuery({
    queryKey: ['crm-pipeline'],
    queryFn: () => apiGet<{ stage: string; count: number; totalValue: number }[]>('/crm/pipeline'),
  });

  const { data: deals } = useQuery({
    queryKey: ['crm-deals'],
    queryFn: () => apiGet<any[]>('/crm/deals'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) => apiPatch(`/crm/deals/${id}`, { stage }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['crm-deals'] }); queryClient.invalidateQueries({ queryKey: ['crm-pipeline'] }); },
  });

  const stages = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex gap-4">
          {pipeline?.filter(p => p.stage !== 'lost').map(p => (
            <div key={p.stage} className="text-center">
              <div className="text-lg font-bold text-neutral-800 dark:text-neutral-100">{p.count}</div>
              <div className="text-xs text-neutral-400">{STAGE_LABELS[p.stage]}</div>
            </div>
          ))}
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary"><Plus size={16} /> Deal</button>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {stages.filter(s => s !== 'lost').map(stage => (
          <div key={stage} className="min-w-[250px] flex-shrink-0">
            <div className="flex items-center gap-2 mb-2">
              <span className={`badge ${STAGE_COLORS[stage]}`}>{STAGE_LABELS[stage]}</span>
              <span className="text-xs text-neutral-400">{deals?.filter(d => d.stage === stage).length || 0}</span>
            </div>
            <div className="space-y-2">
              {deals?.filter(d => d.stage === stage).map(deal => (
                <div key={deal.id} className="card p-3">
                  <div className="font-medium text-sm text-neutral-800 dark:text-neutral-100">{deal.title}</div>
                  {deal.companyName && <div className="text-xs text-neutral-400 mt-0.5">{deal.companyName}</div>}
                  {deal.value && (
                    <div className="text-sm font-semibold text-emerald-600 mt-1">
                      {parseFloat(deal.value).toLocaleString('de-AT')} {deal.currency}
                    </div>
                  )}
                  <div className="flex gap-1 mt-2">
                    {stages.filter(s => s !== 'lost' && s !== stage).slice(0, 2).map(s => (
                      <button key={s} onClick={() => updateMutation.mutate({ id: deal.id, stage: s })}
                        className="text-[10px] px-2 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:bg-accent/10 hover:text-accent">
                        → {STAGE_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {showForm && <CreateDealModal onClose={() => setShowForm(false)} />}
    </div>
  );
}

function ContactsView() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: contacts } = useQuery({
    queryKey: ['crm-contacts'],
    queryFn: () => apiGet<any[]>('/crm/contacts'),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(true)} className="btn-primary"><Plus size={16} /> Kontakt</button>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-neutral-50 dark:bg-neutral-800/50 border-b border-neutral-200 dark:border-neutral-700">
              <th className="text-left text-xs font-semibold text-neutral-500 uppercase px-4 py-3">Name</th>
              <th className="text-left text-xs font-semibold text-neutral-500 uppercase px-4 py-3">Unternehmen</th>
              <th className="text-left text-xs font-semibold text-neutral-500 uppercase px-4 py-3">E-Mail</th>
              <th className="text-left text-xs font-semibold text-neutral-500 uppercase px-4 py-3">Telefon</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {!contacts?.length ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-neutral-400">Keine Kontakte</td></tr>
            ) : contacts.map((c: any) => (
              <tr key={c.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/30">
                <td className="px-4 py-3 text-sm font-medium text-neutral-800 dark:text-neutral-200">{c.firstName} {c.lastName}</td>
                <td className="px-4 py-3 text-sm text-neutral-500">{c.companyName || '-'}</td>
                <td className="px-4 py-3 text-sm text-neutral-500">{c.email || '-'}</td>
                <td className="px-4 py-3 text-sm text-neutral-500">{c.phone || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showForm && <CreateContactModal onClose={() => setShowForm(false)} />}
    </div>
  );
}

function CompaniesView() {
  const [showForm, setShowForm] = useState(false);
  const { data: companies } = useQuery({
    queryKey: ['crm-companies'],
    queryFn: () => apiGet<any[]>('/crm/companies'),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setShowForm(true)} className="btn-primary"><Plus size={16} /> Unternehmen</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {!companies?.length ? (
          <div className="col-span-full card p-8 text-center text-neutral-400">Keine Unternehmen</div>
        ) : companies.map((c: any) => (
          <div key={c.id} className="card p-4">
            <div className="font-medium text-neutral-800 dark:text-neutral-100">{c.name}</div>
            {c.industry && <div className="text-xs text-neutral-400 mt-0.5">{c.industry}</div>}
            <div className="flex gap-3 mt-3 text-xs text-neutral-500">
              {c.website && <span className="flex items-center gap-1"><Globe size={12} /> {c.website}</span>}
              {c.phone && <span className="flex items-center gap-1"><Phone size={12} /> {c.phone}</span>}
            </div>
          </div>
        ))}
      </div>
      {showForm && <CreateCompanyModal onClose={() => setShowForm(false)} />}
    </div>
  );
}

function CreateDealModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: '', value: '', stage: 'lead' });
  const mut = useMutation({
    mutationFn: (d: any) => apiPost('/crm/deals', d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-deals'] }); qc.invalidateQueries({ queryKey: ['crm-pipeline'] }); onClose(); },
  });
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card p-6 w-full max-w-md">
        <div className="flex justify-between mb-4"><h3 className="font-semibold text-neutral-800 dark:text-neutral-100">Neuer Deal</h3><button onClick={onClose}><X size={18} /></button></div>
        <form onSubmit={e => { e.preventDefault(); mut.mutate({ ...form, value: form.value || undefined }); }} className="space-y-3">
          <div><label className="label">Titel</label><input className="input" required value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
          <div><label className="label">Wert (EUR)</label><input className="input" type="number" step="0.01" value={form.value} onChange={e => setForm({...form, value: e.target.value})} /></div>
          <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="btn-secondary">Abbrechen</button><button type="submit" className="btn-primary">Erstellen</button></div>
        </form>
      </div>
    </div>
  );
}

function CreateContactModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '' });
  const mut = useMutation({ mutationFn: (d: any) => apiPost('/crm/contacts', d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-contacts'] }); onClose(); } });
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card p-6 w-full max-w-md">
        <div className="flex justify-between mb-4"><h3 className="font-semibold text-neutral-800 dark:text-neutral-100">Neuer Kontakt</h3><button onClick={onClose}><X size={18} /></button></div>
        <form onSubmit={e => { e.preventDefault(); mut.mutate(form); }} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Vorname</label><input className="input" required value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})} /></div>
            <div><label className="label">Nachname</label><input className="input" required value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})} /></div>
          </div>
          <div><label className="label">E-Mail</label><input className="input" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} /></div>
          <div><label className="label">Telefon</label><input className="input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
          <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="btn-secondary">Abbrechen</button><button type="submit" className="btn-primary">Erstellen</button></div>
        </form>
      </div>
    </div>
  );
}

function CreateCompanyModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', website: '', industry: '', phone: '' });
  const mut = useMutation({ mutationFn: (d: any) => apiPost('/crm/companies', d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['crm-companies'] }); onClose(); } });
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card p-6 w-full max-w-md">
        <div className="flex justify-between mb-4"><h3 className="font-semibold text-neutral-800 dark:text-neutral-100">Neues Unternehmen</h3><button onClick={onClose}><X size={18} /></button></div>
        <form onSubmit={e => { e.preventDefault(); mut.mutate(form); }} className="space-y-3">
          <div><label className="label">Name</label><input className="input" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
          <div><label className="label">Website</label><input className="input" value={form.website} onChange={e => setForm({...form, website: e.target.value})} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Branche</label><input className="input" value={form.industry} onChange={e => setForm({...form, industry: e.target.value})} /></div>
            <div><label className="label">Telefon</label><input className="input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} /></div>
          </div>
          <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="btn-secondary">Abbrechen</button><button type="submit" className="btn-primary">Erstellen</button></div>
        </form>
      </div>
    </div>
  );
}
