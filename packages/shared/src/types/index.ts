import type { Role } from '../constants/roles.js';
import type { ModuleId } from '../constants/modules.js';

export type NotificationCategory =
  | 'chat'
  | 'community'
  | 'tasks'
  | 'calendar'
  | 'leave'
  | 'time_tracking'
  | 'ai_assistants'
  | 'system';

export type NotificationChannel = 'inApp' | 'email' | 'push';

export interface NotificationCategoryPreference {
  inApp: boolean;
  email: boolean;
  push: boolean;
}

export interface NotificationPreferences {
  chat: NotificationCategoryPreference;
  community: NotificationCategoryPreference;
  tasks: NotificationCategoryPreference;
  calendar: NotificationCategoryPreference;
  leave: NotificationCategoryPreference;
  time_tracking: NotificationCategoryPreference;
  ai_assistants: NotificationCategoryPreference;
  system: NotificationCategoryPreference;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  department: string | null;
  position: string | null;
  phone: string | null;
  avatarUrl: string | null;
  supervisorId: string | null;
  orgId: string;
  vacationDaysPerYear: number;
  weeklyTargetHours: number;
  timeEditsRequireApproval: boolean;
  notificationPreferences: NotificationPreferences;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PushDevice {
  id: string;
  platform: 'web' | 'expo';
  endpoint: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserWithSupervisor extends User {
  supervisor: Pick<User, 'id' | 'firstName' | 'lastName' | 'email'> | null;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  timezone: string;
  locale: string;
  coreHoursStart: string | null;
  coreHoursEnd: string | null;
  breakAfterMinutes: number;
  breakDurationMinutes: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserModulePermission {
  userId: string;
  moduleId: ModuleId;
  isEnabled: boolean;
  grantedAt: string;
  grantedBy: string | null;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
  orgId: string;
  modules: ModuleId[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface ApiResponse<T> {
  data: T;
  statusCode: number;
}

export interface ApiError {
  error: string;
  message: string;
  details?: Record<string, string[]>;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  moduleId: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
