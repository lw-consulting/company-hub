import { useState, useEffect } from 'react';
import { useAuthStore } from '../../stores/auth.store';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../lib/api';
import { Bell, User, Menu, Moon, Sun } from 'lucide-react';

interface HeaderProps {
  title: string;
  onMobileMenuToggle?: () => void;
}

function useDarkMode() {
  const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
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
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onMobileMenuToggle}
          className="lg:hidden text-slate-500 hover:text-slate-700 dark:text-slate-400"
        >
          <Menu size={22} />
        </button>
        <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        {/* Dark mode toggle */}
        <button
          onClick={toggleDark}
          className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          {dark ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        {/* Notifications */}
        <button className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 rounded-lg transition-colors">
          <Bell size={20} />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </button>

        {/* User avatar */}
        <div className="flex items-center gap-3 pl-3 border-l border-slate-200 dark:border-slate-700">
          <div className="w-8 h-8 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <User size={16} className="text-indigo-600 dark:text-indigo-400" />
            )}
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {user?.firstName} {user?.lastName}
            </div>
            <div className="text-xs text-slate-400">{user?.role}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
