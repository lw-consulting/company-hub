import { pgTable, uuid, varchar, boolean, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { users } from './users.js';

export const userModulePermissions = pgTable(
  'user_module_permissions',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    moduleId: varchar('module_id', { length: 50 }).notNull(),
    isEnabled: boolean('is_enabled').notNull().default(true),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
    grantedBy: uuid('granted_by').references(() => users.id, { onDelete: 'set null' }),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.moduleId] }),
  ]
);
