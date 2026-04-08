import { create } from 'zustand';
import { apiGet } from '../lib/api';

interface Branding {
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  locale: string;
}

interface OrgState {
  branding: Branding | null;
  loading: boolean;
  fetchBranding: () => Promise<void>;
  setBranding: (b: Partial<Branding>) => void;
}

export const useOrgStore = create<OrgState>((set, get) => ({
  branding: null,
  loading: false,
  fetchBranding: async () => {
    set({ loading: true });
    try {
      const branding = await apiGet<Branding>('/organizations/branding');
      set({ branding, loading: false });
      if (branding?.name) document.title = branding.name;
    } catch {
      set({ loading: false });
    }
  },
  setBranding: (partial) => {
    const current = get().branding;
    if (current) {
      const updated = { ...current, ...partial };
      set({ branding: updated });
      if (updated.name) document.title = updated.name;
    }
  },
}));
