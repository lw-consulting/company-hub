export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  HR: 'hr',
  MANAGER: 'manager',
  EDITOR: 'editor',
  USER: 'user',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_HIERARCHY: Record<Role, number> = {
  super_admin: 5,
  admin: 4,
  hr: 3,
  manager: 2,
  editor: 1,
  user: 0,
};

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super Admin',
  admin: 'Administrator',
  hr: 'HR',
  manager: 'Manager',
  editor: 'Editor',
  user: 'Mitarbeiter',
};
