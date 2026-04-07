export const MODULE_IDS = {
  DASHBOARD: 'dashboard',
  AI_ASSISTANTS: 'ai-assistants',
  COMMUNITY: 'community',
  TIME_TRACKING: 'time-tracking',
  LEAVE: 'leave',
  CALENDAR: 'calendar',
  TASKS: 'tasks',
  COURSES: 'courses',
} as const;

export type ModuleId = (typeof MODULE_IDS)[keyof typeof MODULE_IDS];

export interface ModuleDefinition {
  id: ModuleId;
  name: string;
  description: string;
  icon: string;
  defaultEnabled: boolean;
  navGroup: 'main' | 'hr' | 'learn';
  navOrder: number;
}

export const MODULES: ModuleDefinition[] = [
  {
    id: MODULE_IDS.DASHBOARD,
    name: 'Dashboard',
    description: 'Startseite mit Übersicht',
    icon: 'LayoutDashboard',
    defaultEnabled: true,
    navGroup: 'main',
    navOrder: 0,
  },
  {
    id: MODULE_IDS.COMMUNITY,
    name: 'Community',
    description: 'Forum & Social Feed',
    icon: 'Users',
    defaultEnabled: true,
    navGroup: 'main',
    navOrder: 1,
  },
  {
    id: MODULE_IDS.TASKS,
    name: 'Aufgaben',
    description: 'Aufgabenverwaltung',
    icon: 'CheckSquare',
    defaultEnabled: true,
    navGroup: 'main',
    navOrder: 2,
  },
  {
    id: MODULE_IDS.CALENDAR,
    name: 'Kalender',
    description: 'Persönlicher & Team-Kalender',
    icon: 'Calendar',
    defaultEnabled: true,
    navGroup: 'main',
    navOrder: 3,
  },
  {
    id: MODULE_IDS.TIME_TRACKING,
    name: 'Zeiterfassung',
    description: 'Kommen/Gehen stempeln & Stundenübersicht',
    icon: 'Clock',
    defaultEnabled: true,
    navGroup: 'hr',
    navOrder: 0,
  },
  {
    id: MODULE_IDS.LEAVE,
    name: 'Urlaub',
    description: 'Urlaubsanträge & Resturlaub',
    icon: 'Palmtree',
    defaultEnabled: true,
    navGroup: 'hr',
    navOrder: 1,
  },
  {
    id: MODULE_IDS.AI_ASSISTANTS,
    name: 'KI-Assistenten',
    description: 'Individuelle KI-Chatbots',
    icon: 'Bot',
    defaultEnabled: false,
    navGroup: 'learn',
    navOrder: 0,
  },
  {
    id: MODULE_IDS.COURSES,
    name: 'Kurse',
    description: 'Onboarding & Weiterbildung',
    icon: 'GraduationCap',
    defaultEnabled: false,
    navGroup: 'learn',
    navOrder: 1,
  },
];
