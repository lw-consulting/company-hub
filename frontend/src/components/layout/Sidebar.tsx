import { useAuthStore } from '../../stores/auth.store';
import { getNavigationItems, type NavItem } from '../../lib/module-registry';
import { LogOut, ChevronLeft } from 'lucide-react';
import type { Role, ModuleId } from '@company-hub/shared';

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const GROUP_LABELS: Record<string, string> = {
  main: 'ALLGEMEIN',
  hr: 'HR & ZEIT',
  learn: 'LERNEN & KI',
  admin: 'VERWALTUNG',
};

export default function Sidebar({ currentPath, onNavigate, collapsed, onToggleCollapse }: SidebarProps) {
  const { user, modules, logout } = useAuthStore();
  if (!user) return null;

  const navItems = getNavigationItems(modules, user.role as Role);
  const groups = new Map<string, NavItem[]>();
  for (const item of navItems) {
    const existing = groups.get(item.group) || [];
    existing.push(item);
    groups.set(item.group, existing.sort((a, b) => a.order - b.order));
  }
  const groupOrder = ['main', 'hr', 'learn', 'admin'];

  return (
    <aside className={`fixed left-0 top-0 h-full bg-white dark:bg-neutral-950 border-r border-neutral-100 dark:border-neutral-800 z-30 flex flex-col transition-all duration-300 ${collapsed ? 'w-[68px]' : 'w-[260px]'}`}>
      {/* Logo */}
      <div className="h-16 flex items-center px-5 flex-shrink-0">
        <div className="w-8 h-8 bg-neutral-900 dark:bg-white rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-white dark:text-neutral-900 text-xs font-black">CH</span>
        </div>
        {!collapsed && (
          <span className="ml-3 font-bold text-neutral-900 dark:text-white text-sm tracking-tight">Company Hub</span>
        )}
        <button onClick={onToggleCollapse} className="ml-auto text-neutral-300 hover:text-neutral-500 dark:text-neutral-600 dark:hover:text-neutral-400">
          <ChevronLeft size={16} className={`transition-transform duration-300 ${collapsed ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-6 px-3">
        {groupOrder.map((group) => {
          const items = groups.get(group);
          if (!items?.length) return null;
          return (
            <div key={group} className="mb-6">
              {!collapsed && (
                <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-400 dark:text-neutral-600">
                  {GROUP_LABELS[group]}
                </div>
              )}
              <div className="space-y-0.5">
                {items.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentPath === item.path || (item.path !== '/' && currentPath.startsWith(item.path));
                  return (
                    <button
                      key={item.id}
                      onClick={() => onNavigate(item.path)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all duration-150 ${
                        isActive
                          ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                          : 'text-neutral-500 hover:text-neutral-800 hover:bg-neutral-50 dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:bg-neutral-900'
                      }`}
                      title={collapsed ? item.name : undefined}
                    >
                      <Icon size={18} className="flex-shrink-0" strokeWidth={isActive ? 2.5 : 1.5} />
                      {!collapsed && <span className="truncate">{item.name}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-neutral-100 dark:border-neutral-800">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
          title="Abmelden"
        >
          <LogOut size={18} className="flex-shrink-0" strokeWidth={1.5} />
          {!collapsed && <span>Abmelden</span>}
        </button>
      </div>
    </aside>
  );
}
