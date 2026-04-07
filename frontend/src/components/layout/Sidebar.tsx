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
  main: 'Allgemein',
  hr: 'HR & Zeit',
  learn: 'Lernen & KI',
  admin: 'Administration',
};

export default function Sidebar({ currentPath, onNavigate, collapsed, onToggleCollapse }: SidebarProps) {
  const { user, modules, logout } = useAuthStore();
  if (!user) return null;

  const navItems = getNavigationItems(modules, user.role as Role);

  // Group items
  const groups = new Map<string, NavItem[]>();
  for (const item of navItems) {
    const existing = groups.get(item.group) || [];
    existing.push(item);
    groups.set(item.group, existing);
  }

  // Sort within groups
  for (const [, items] of groups) {
    items.sort((a, b) => a.order - b.order);
  }

  const groupOrder = ['main', 'hr', 'learn', 'admin'];

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-30 flex flex-col transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b border-border-light flex-shrink-0">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-white text-sm font-bold">CH</span>
        </div>
        {!collapsed && (
          <span className="ml-3 font-semibold text-slate-800 truncate">Company Hub</span>
        )}
        <button
          onClick={onToggleCollapse}
          className="ml-auto text-slate-400 hover:text-slate-600 p-1"
        >
          <ChevronLeft size={18} className={`transition-transform ${collapsed ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        {groupOrder.map((group) => {
          const items = groups.get(group);
          if (!items?.length) return null;

          return (
            <div key={group} className="mb-4">
              {!collapsed && (
                <div className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {GROUP_LABELS[group]}
                </div>
              )}
              <div className="space-y-0.5">
                {items.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentPath === item.path ||
                    (item.path !== '/' && currentPath.startsWith(item.path));

                  return (
                    <button
                      key={item.id}
                      onClick={() => onNavigate(item.path)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-primary-50 text-primary-dark'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                      }`}
                      title={collapsed ? item.name : undefined}
                    >
                      <Icon size={20} className="flex-shrink-0" />
                      {!collapsed && <span className="truncate">{item.name}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User/Logout */}
      <div className="border-t border-border-light p-2">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors"
          title="Abmelden"
        >
          <LogOut size={20} className="flex-shrink-0" />
          {!collapsed && <span>Abmelden</span>}
        </button>
      </div>
    </aside>
  );
}
