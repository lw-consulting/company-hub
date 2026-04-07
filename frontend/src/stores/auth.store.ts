import { create } from 'zustand';
import { api, clearTokens } from '../lib/api';
import type { User, Role, ModuleId } from '@company-hub/shared';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  modules: ModuleId[];
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  setModulesFromToken: () => void;
}

function parseJwt(token: string): any {
  try {
    const base64 = token.split('.')[1];
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: !!localStorage.getItem('accessToken'),
  isLoading: false,
  modules: [],

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const tokens = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        skipAuth: true,
      });

      localStorage.setItem('accessToken', tokens.accessToken);
      localStorage.setItem('refreshToken', tokens.refreshToken);

      // Extract modules from JWT
      const payload = parseJwt(tokens.accessToken);
      const modules = payload?.modules || [];

      set({ isAuthenticated: true, modules });
      await get().fetchMe();
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
      // Ignore errors on logout
    }
    clearTokens();
    set({ user: null, isAuthenticated: false, modules: [] });
  },

  fetchMe: async () => {
    try {
      const user = await api('/auth/me');
      // Also refresh modules from current token
      const token = localStorage.getItem('accessToken');
      const payload = token ? parseJwt(token) : null;
      set({ user, isAuthenticated: true, modules: payload?.modules || [] });
    } catch {
      clearTokens();
      set({ user: null, isAuthenticated: false, modules: [] });
    }
  },

  setModulesFromToken: () => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      const payload = parseJwt(token);
      set({ modules: payload?.modules || [] });
    }
  },
}));
