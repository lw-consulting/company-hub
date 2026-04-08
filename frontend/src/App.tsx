import { useEffect } from 'react';
import { useAuthStore } from './stores/auth.store';
import { useOrgStore } from './stores/org.store';
import LoginPage from './modules/auth/LoginPage';
import AppShell from './components/layout/AppShell';

export default function App() {
  const { isAuthenticated, fetchMe, user } = useAuthStore();
  const { branding, loading: brandingLoading, fetchBranding } = useOrgStore();
  const brandingLoaded = !!branding || !brandingLoading;

  // Load branding/CI on mount
  useEffect(() => {
    fetchBranding();
  }, []);

  // Apply CSS variables when branding changes
  useEffect(() => {
    if (!branding) return;
    const root = document.documentElement;
    if (branding.primaryColor) {
      root.style.setProperty('--color-primary', branding.primaryColor);
      root.style.setProperty('--color-primary-light', lighten(branding.primaryColor, 15));
      root.style.setProperty('--color-primary-dark', darken(branding.primaryColor, 12));
      root.style.setProperty('--color-primary-50', lighten(branding.primaryColor, 42));
    }
    if (branding.secondaryColor) {
      root.style.setProperty('--color-secondary', branding.secondaryColor);
      root.style.setProperty('--color-secondary-light', lighten(branding.secondaryColor, 10));
    }
    if (branding.accentColor) {
      root.style.setProperty('--color-accent', branding.accentColor);
      root.style.setProperty('--color-accent-light', lighten(branding.accentColor, 15));
    }
  }, [branding]);

  // Fetch user profile on mount if token exists
  useEffect(() => {
    if (isAuthenticated && !user) {
      fetchMe();
    }
  }, [isAuthenticated]);

  if (brandingLoading && !brandingLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <AppShell />;
}

// Color utility functions
function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h * 360, s * 100, l * 100];
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function lighten(hex: string, amount: number): string {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex(h, s, Math.min(100, l + amount));
}

function darken(hex: string, amount: number): string {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex(h, s, Math.max(0, l - amount));
}
