import { useAuthStore } from '../../stores/auth.store';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '../../lib/api';
import { Bell, User, Menu } from 'lucide-react';

interface HeaderProps {
  title: string;
  onMobileMenuToggle?: () => void;
}

export default function Header({ title, onMobileMenuToggle }: HeaderProps) {
  const { user } = useAuthStore();

  const { data: unreadCount } = useQuery({
    queryKey: ['notifications-unread'],
    queryFn: () => apiGet<{ count: number }>('/notifications/unread-count'),
    refetchInterval: 30_000,
  });

  const count = unreadCount?.count || 0;

  return (
    <header className="h-16 bg-white border-b border-border-light flex items-center justify-between px-6">
      <div className="flex items-center gap-4">
        <button
          onClick={onMobileMenuToggle}
          className="lg:hidden text-slate-500 hover:text-slate-700"
        >
          <Menu size={22} />
        </button>
        <h1 className="text-lg font-semibold text-slate-800">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        {/* Notifications */}
        <button className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
          <Bell size={20} />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </button>

        {/* User avatar */}
        <div className="flex items-center gap-3 pl-3 border-l border-border-light">
          <div className="w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <User size={16} className="text-primary" />
            )}
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-medium text-slate-700">
              {user?.firstName} {user?.lastName}
            </div>
            <div className="text-xs text-slate-400">{user?.role}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
