import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiGet, apiPatch, resolveImageUrl } from '../../lib/api';
import { useOrgStore } from '../../stores/org.store';
import { Save, Palette, Building2, Clock, Check, Upload, X } from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  timezone: string;
  locale: string;
  coreHoursStart: string | null;
  coreHoursEnd: string | null;
  breakAfterMinutes: number;
  breakDurationMinutes: number;
}

export default function OrganizationPage() {
  const queryClient = useQueryClient();
  const { setBranding, fetchBranding } = useOrgStore();
  const [form, setForm] = useState<Partial<Organization>>({});
  const [saved, setSaved] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const { data: org, isLoading } = useQuery({
    queryKey: ['organization'],
    queryFn: () => apiGet<Organization>('/organizations/current'),
  });

  useEffect(() => {
    if (org) setForm(org);
  }, [org]);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Organization>) => apiPatch('/organizations/current', data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['organization'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      // Sync branding store + CSS vars
      setBranding({
        name: data.name,
        primaryColor: data.primaryColor,
        secondaryColor: data.secondaryColor,
        accentColor: data.accentColor,
      });
      if (data.primaryColor) document.documentElement.style.setProperty('--color-primary', data.primaryColor);
      if (data.secondaryColor) document.documentElement.style.setProperty('--color-secondary', data.secondaryColor);
      if (data.accentColor) document.documentElement.style.setProperty('--color-accent', data.accentColor);
    },
  });

  const logoUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return api<{ logoUrl: string }>('/files/logo', { method: 'POST', body: fd });
    },
    onSuccess: (data) => {
      setForm((prev) => ({ ...prev, logoUrl: data.logoUrl }));
      setBranding({ logoUrl: data.logoUrl });
      queryClient.invalidateQueries({ queryKey: ['organization'] });
      fetchBranding();
    },
  });

  const handleLogoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) logoUploadMutation.mutate(file);
    e.target.value = '';
  };

  const handleRemoveLogo = () => {
    setForm({ ...form, logoUrl: null });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { id, slug, ...updateData } = form as any;
    updateMutation.mutate(updateData);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64 text-neutral-400">Laden...</div>;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* General */}
        <div className="card p-6">
          <h3 className="font-semibold text-neutral-800 mb-4 flex items-center gap-2">
            <Building2 size={18} className="text-primary" />
            Allgemein
          </h3>
          <div className="space-y-4">
            <div>
              <label className="label">Organisationsname</label>
              <input
                className="input"
                value={form.name || ''}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Zeitzone</label>
                <select
                  className="input"
                  value={form.timezone || 'Europe/Vienna'}
                  onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                >
                  <option value="Europe/Vienna">Europe/Vienna</option>
                  <option value="Europe/Berlin">Europe/Berlin</option>
                  <option value="Europe/Zurich">Europe/Zurich</option>
                  <option value="UTC">UTC</option>
                </select>
              </div>
              <div>
                <label className="label">Sprache</label>
                <select
                  className="input"
                  value={form.locale || 'de'}
                  onChange={(e) => setForm({ ...form, locale: e.target.value })}
                >
                  <option value="de">Deutsch</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Branding / CI */}
        <div className="card p-6">
          <h3 className="font-semibold text-neutral-800 mb-4 flex items-center gap-2">
            <Palette size={18} className="text-primary" />
            Corporate Identity
          </h3>
          <div className="space-y-4">
            <div>
              <label className="label">Logo</label>
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-xl border-2 border-dashed border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {form.logoUrl ? (
                    <img
                      src={resolveImageUrl(form.logoUrl)}
                      alt="Logo"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <Building2 size={28} className="text-neutral-300 dark:text-neutral-600" />
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={handleLogoFile}
                  />
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="btn-secondary"
                    disabled={logoUploadMutation.isPending}
                  >
                    <Upload size={14} />
                    {logoUploadMutation.isPending ? 'Wird hochgeladen...' : form.logoUrl ? 'Logo ersetzen' : 'Logo hochladen'}
                  </button>
                  {form.logoUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1"
                    >
                      <X size={12} /> Logo entfernen
                    </button>
                  )}
                  <p className="text-xs text-neutral-400">PNG, JPG, WebP oder SVG, max. 2MB</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <ColorPicker
                label="Primärfarbe"
                value={form.primaryColor || '#6366f1'}
                onChange={(v) => setForm({ ...form, primaryColor: v })}
              />
              <ColorPicker
                label="Sekundärfarbe"
                value={form.secondaryColor || '#1e1b4b'}
                onChange={(v) => setForm({ ...form, secondaryColor: v })}
              />
              <ColorPicker
                label="Akzentfarbe"
                value={form.accentColor || '#f59e0b'}
                onChange={(v) => setForm({ ...form, accentColor: v })}
              />
            </div>

            {/* Preview */}
            <div className="mt-4 p-4 bg-surface-secondary rounded-lg">
              <p className="text-xs text-neutral-400 mb-3 uppercase font-semibold tracking-wider">Vorschau</p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="px-4 py-2 rounded text-white text-sm font-medium"
                  style={{ backgroundColor: form.primaryColor }}
                >
                  Primär-Button
                </button>
                <button
                  type="button"
                  className="px-4 py-2 rounded text-white text-sm font-medium"
                  style={{ backgroundColor: form.secondaryColor }}
                >
                  Sekundär-Button
                </button>
                <button
                  type="button"
                  className="px-4 py-2 rounded text-white text-sm font-medium"
                  style={{ backgroundColor: form.accentColor }}
                >
                  Akzent-Button
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Work Time Settings */}
        <div className="card p-6">
          <h3 className="font-semibold text-neutral-800 mb-4 flex items-center gap-2">
            <Clock size={18} className="text-primary" />
            Arbeitszeiteinstellungen
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Kernzeit Start</label>
                <input
                  type="time"
                  className="input"
                  value={form.coreHoursStart || ''}
                  onChange={(e) => setForm({ ...form, coreHoursStart: e.target.value || null })}
                />
              </div>
              <div>
                <label className="label">Kernzeit Ende</label>
                <input
                  type="time"
                  className="input"
                  value={form.coreHoursEnd || ''}
                  onChange={(e) => setForm({ ...form, coreHoursEnd: e.target.value || null })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Auto-Pause nach (Minuten)</label>
                <input
                  type="number"
                  className="input"
                  min={0}
                  max={720}
                  value={form.breakAfterMinutes || 360}
                  onChange={(e) => setForm({ ...form, breakAfterMinutes: Number(e.target.value) })}
                />
                <p className="text-xs text-neutral-400 mt-1">Standard: 360 Min (6 Std)</p>
              </div>
              <div>
                <label className="label">Pausendauer (Minuten)</label>
                <input
                  type="number"
                  className="input"
                  min={0}
                  max={120}
                  value={form.breakDurationMinutes || 30}
                  onChange={(e) => setForm({ ...form, breakDurationMinutes: Number(e.target.value) })}
                />
                <p className="text-xs text-neutral-400 mt-1">Standard: 30 Min</p>
              </div>
            </div>
          </div>
        </div>

        {/* Save */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="btn-primary"
            disabled={updateMutation.isPending}
          >
            {saved ? (
              <>
                <Check size={18} />
                Gespeichert
              </>
            ) : updateMutation.isPending ? (
              'Speichere...'
            ) : (
              <>
                <Save size={18} />
                Speichern
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 rounded cursor-pointer border border-border"
        />
        <input
          type="text"
          className="input flex-1"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          pattern="^#[0-9a-fA-F]{6}$"
        />
      </div>
    </div>
  );
}
