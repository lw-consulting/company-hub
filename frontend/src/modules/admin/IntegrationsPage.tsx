import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete } from '../../lib/api';
import { Webhook, Key, Plus, Trash2, X, Copy, Check, Eye, EyeOff, ToggleLeft, ToggleRight } from 'lucide-react';

// ============== WEBHOOKS TAB ==============

function WebhooksTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: hooks } = useQuery({
    queryKey: ['webhooks'],
    queryFn: () => apiGet<any[]>('/integrations/webhooks'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`/integrations/webhooks/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['webhooks'] }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      apiPatch(`/integrations/webhooks/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['webhooks'] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500">{hooks?.length || 0} Webhooks konfiguriert</p>
        <button onClick={() => setShowForm(true)} className="btn-primary"><Plus size={16} /> Webhook</button>
      </div>

      <div className="space-y-2">
        {!hooks?.length ? (
          <div className="card p-8 text-center text-neutral-400">Noch keine Webhooks. Verbinden Sie externe Tools wie Zapier, Make oder N8n.</div>
        ) : hooks.map((h: any) => (
          <div key={h.id} className="card p-4 flex items-center gap-4">
            <Webhook size={18} className="text-neutral-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-neutral-800">{h.name}</div>
              <div className="text-xs text-neutral-400 truncate">{h.url}</div>
              <div className="flex gap-1 mt-1 flex-wrap">
                {(h.events as string[])?.slice(0, 3).map((e: string) => (
                  <span key={e} className="badge-primary text-[10px]">{e}</span>
                ))}
                {(h.events as string[])?.length > 3 && (
                  <span className="text-[10px] text-neutral-400">+{(h.events as string[]).length - 3}</span>
                )}
              </div>
            </div>
            <button onClick={() => toggleMutation.mutate({ id: h.id, isActive: !h.isActive })}
              className={h.isActive ? 'text-emerald-500' : 'text-neutral-300'}>
              {h.isActive ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
            </button>
            <button onClick={() => deleteMutation.mutate(h.id)} className="text-neutral-300 hover:text-red-500">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>

      {showForm && <CreateWebhookModal onClose={() => setShowForm(false)} />}
    </div>
  );
}

function CreateWebhookModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', url: '', events: [] as string[] });
  const [createdSecret, setCreatedSecret] = useState('');

  const { data: events } = useQuery({
    queryKey: ['webhook-events'],
    queryFn: () => apiGet<string[]>('/integrations/webhook-events'),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiPost('/integrations/webhooks', data),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      setCreatedSecret(result.secret);
    },
  });

  if (createdSecret) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="card p-6 w-full max-w-md">
          <h3 className="text-lg font-semibold text-neutral-800 mb-4">Webhook erstellt</h3>
          <p className="text-sm text-neutral-500 mb-3">Kopieren Sie den Signing-Secret. Er wird nur einmal angezeigt:</p>
          <div className="bg-neutral-100 p-3 rounded font-mono text-sm break-all">{createdSecret}</div>
          <button onClick={onClose} className="btn-primary w-full mt-4">Fertig</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-neutral-800">Neuer Webhook</h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600"><X size={20} /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input className="input" required placeholder="z.B. Zapier Integration" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">URL</label>
            <input className="input" required type="url" placeholder="https://hooks.zapier.com/..." value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
          </div>
          <div>
            <label className="label">Events</label>
            <div className="grid grid-cols-2 gap-1 mt-1">
              {events?.map((e) => (
                <label key={e} className="flex items-center gap-2 text-sm text-neutral-600 p-1">
                  <input type="checkbox" checked={form.events.includes(e)}
                    onChange={(ev) => setForm({ ...form, events: ev.target.checked ? [...form.events, e] : form.events.filter(x => x !== e) })} />
                  {e}
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Abbrechen</button>
            <button type="submit" className="btn-primary" disabled={createMutation.isPending}>Erstellen</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============== API KEYS TAB ==============

function ApiKeysTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data: keys } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => apiGet<any[]>('/integrations/api-keys'),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => apiPost(`/integrations/api-keys/${id}/revoke`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['api-keys'] }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500">{keys?.length || 0} API-Keys</p>
        <button onClick={() => setShowForm(true)} className="btn-primary"><Plus size={16} /> API-Key</button>
      </div>

      <div className="space-y-2">
        {!keys?.length ? (
          <div className="card p-8 text-center text-neutral-400">Noch keine API-Keys. Erstellen Sie einen für externe Systeme.</div>
        ) : keys.map((k: any) => (
          <div key={k.id} className="card p-4 flex items-center gap-4">
            <Key size={18} className="text-neutral-400 flex-shrink-0" />
            <div className="flex-1">
              <div className="font-medium text-neutral-800">{k.name}</div>
              <div className="text-xs text-neutral-400 font-mono">{k.keyPrefix}...●●●●●●</div>
              <div className="flex gap-1 mt-1">
                {(k.scopes as string[])?.slice(0, 3).map((s: string) => (
                  <span key={s} className="badge-primary text-[10px]">{s}</span>
                ))}
              </div>
            </div>
            <span className={`text-xs ${k.isActive ? 'text-emerald-600' : 'text-red-500'}`}>
              {k.isActive ? 'Aktiv' : 'Widerrufen'}
            </span>
            {k.isActive && (
              <button onClick={() => revokeMutation.mutate(k.id)} className="text-xs text-red-500 hover:underline">
                Widerrufen
              </button>
            )}
          </div>
        ))}
      </div>

      {showForm && <CreateApiKeyModal onClose={() => setShowForm(false)} />}
    </div>
  );
}

function CreateApiKeyModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ name: '', scopes: [] as string[] });
  const [createdKey, setCreatedKey] = useState('');
  const [copied, setCopied] = useState(false);

  const { data: scopes } = useQuery({
    queryKey: ['api-scopes'],
    queryFn: () => apiGet<string[]>('/integrations/api-scopes'),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiPost('/integrations/api-keys', data),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      setCreatedKey(result.key);
    },
  });

  if (createdKey) {
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="card p-6 w-full max-w-md">
          <h3 className="text-lg font-semibold text-neutral-800 mb-4">API-Key erstellt</h3>
          <p className="text-sm text-neutral-500 mb-3">Kopieren Sie den Key. Er wird nur einmal angezeigt:</p>
          <div className="bg-neutral-100 p-3 rounded font-mono text-xs break-all flex items-center gap-2">
            <span className="flex-1">{createdKey}</span>
            <button onClick={() => { navigator.clipboard.writeText(createdKey); setCopied(true); }}
              className="text-neutral-400 hover:text-neutral-600 flex-shrink-0">
              {copied ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
            </button>
          </div>
          <button onClick={onClose} className="btn-primary w-full mt-4">Fertig</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="card p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-neutral-800">Neuer API-Key</h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600"><X size={20} /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input className="input" required placeholder="z.B. ERP Integration" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <label className="label">Berechtigungen (Scopes)</label>
            <div className="grid grid-cols-2 gap-1 mt-1">
              {scopes?.map((s) => (
                <label key={s} className="flex items-center gap-2 text-sm text-neutral-600 p-1">
                  <input type="checkbox" checked={form.scopes.includes(s)}
                    onChange={(ev) => setForm({ ...form, scopes: ev.target.checked ? [...form.scopes, s] : form.scopes.filter(x => x !== s) })} />
                  {s}
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Abbrechen</button>
            <button type="submit" className="btn-primary" disabled={createMutation.isPending}>Erstellen</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============== MAIN PAGE ==============

export default function IntegrationsPage() {
  const [tab, setTab] = useState<'webhooks' | 'api-keys'>('webhooks');

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex bg-neutral-100 rounded-lg p-0.5 w-fit">
        <button onClick={() => setTab('webhooks')}
          className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors ${tab === 'webhooks' ? 'bg-white shadow-sm text-neutral-800' : 'text-neutral-500'}`}>
          <Webhook size={16} /> Webhooks
        </button>
        <button onClick={() => setTab('api-keys')}
          className={`flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-colors ${tab === 'api-keys' ? 'bg-white shadow-sm text-neutral-800' : 'text-neutral-500'}`}>
          <Key size={16} /> API-Keys
        </button>
      </div>

      {tab === 'webhooks' ? <WebhooksTab /> : <ApiKeysTab />}
    </div>
  );
}
