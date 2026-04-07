import { MODULES, ROLE_HIERARCHY, type ModuleId, type ModuleDefinition, type Role } from '@company-hub/shared';
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  Calendar,
  Clock,
  Palmtree,
  Bot,
  GraduationCap,
  Settings,
  Bell,
  UserCog,
  Building2,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  id: string;
  name: string;
  icon: LucideIcon;
  path: string;
  group: 'main' | 'hr' | 'learn' | 'admin';
  order: number;
  moduleId?: ModuleId;
  minRole?: Role;
}

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  Users,
  CheckSquare,
  Calendar,
  Clock,
  Palmtree,
  Bot,
  GraduationCap,
};

const PATH_MAP: Record<ModuleId, string> = {
  dashboard: '/',
  community: '/community',
  tasks: '/tasks',
  calendar: '/calendar',
  'time-tracking': '/time-tracking',
  leave: '/leave',
  'ai-assistants': '/ai',
  courses: '/courses',
};

export function getNavigationItems(
  enabledModules: ModuleId[],
  userRole: Role
): NavItem[] {
  const items: NavItem[] = [];

  // Module-based nav items
  for (const mod of MODULES) {
    const icon = ICON_MAP[mod.icon] || LayoutDashboard;

    // Check if user has access (admin bypasses)
    const isAdmin = ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY.admin;
    if (!isAdmin && !enabledModules.includes(mod.id)) continue;

    items.push({
      id: mod.id,
      name: mod.name,
      icon,
      path: PATH_MAP[mod.id] || `/${mod.id}`,
      group: mod.navGroup,
      order: mod.navOrder,
      moduleId: mod.id,
    });
  }

  // Admin section (only for admins+)
  if (ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY.admin) {
    items.push(
      {
        id: 'admin-users',
        name: 'Benutzerverwaltung',
        icon: UserCog,
        path: '/admin/users',
        group: 'admin',
        order: 0,
      },
      {
        id: 'admin-org',
        name: 'Organisation',
        icon: Building2,
        path: '/admin/organization',
        group: 'admin',
        order: 1,
      },
      {
        id: 'admin-settings',
        name: 'Einstellungen',
        icon: Settings,
        path: '/admin/settings',
        group: 'admin',
        order: 2,
      }
    );
  }

  return items;
}
