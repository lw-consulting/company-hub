import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/auth.store';
import { useQuery } from '@tanstack/react-query';
import { apiGet, resolveImageUrl } from '../../lib/api';
import { Bell, User, Menu, Moon, Sun } from 'lucide-react';

interface HeaderProps {
  title: string;
  onMobileMenuToggle?: () => void;
}

function useDarkMode() {
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');
  useEffect(() => {
    if (dark) { document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark'); }
    else { document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light'); }
  }, [dark]);
  return [dark, () => setDark(!dark)] as const;
}

export default function Header({ title, onMobileMenuToggle }: HeaderProps) {
  const { user } = useAuthStore();
  const [dark, toggleDark] = useDarkMode();

  const { data: unreadCount } = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: () => apiGet<{ count: number }>('/notifications/unread-count'),
    refetchInterval: 30_000,
  });

  const count = unreadCount?.count || 0;

  return (
    <header className="h-16 bg-white/80 dark:bg-neutral-950/80 backdrop-blur-lg border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between px-6 sticky top-0 z-20">
      <div className="flex items-center gap-4">
        <button onClick={onMobileMenuToggle} className="lg:hidden text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200">
          <Menu size={20} />
        </button>
        <h1 className="text-lg font-bold text-neutral-900 dark:text-white tracking-tight">{title}</h1>
      </div>

      <div className="flex items-center gap-1">
        <button onClick={toggleDark}
          className="p-2.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors">
          {dark ? <Sun size={18} strokeWidth={1.5} /> : <Moon size={18} strokeWidth={1.5} />}
        </button>

        <button className="relative p-2.5 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-lg transition-colors">
          <Bell size={18} strokeWidth={1.5} />
          {count > 0 && (
            <span className="absolute top-1 right-1 w-4 h-4 text-[9px] font-bold flex items-center justify-center rounded-full" style={{ backgroundColor: 'var(--color-accent)', color: 'white' }}>
              {count > 9 ? '9+' : count}
            </span>
          )}
        </button>

        <div className="flex items-center gap-3 ml-2 pl-3 border-l border-neutral-100 dark:border-neutral-800">
          <div className="w-8 h-8 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center overflow-hidden">
            {user?.avatarUrl ? (
              <img src={resolveImageUrl(user.avatarUrl)} alt="" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <span className="text-xs font-bold text-neutral-500 dark:text-neutral-400">{user?.firstName?.[0]}{user?.lastName?.[0]}</span>
            )}
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-semibold text-neutral-800 dark:text-neutral-100 leading-tight">
              {user?.firstName} {user?.lastName}
            </div>
            <div className="text-[11px] text-neutral-400 leading-tight">{user?.role}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
