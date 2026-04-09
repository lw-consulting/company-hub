import { pgTable, uuid, varchar, text, boolean, timestamp, index, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { organizations } from './organizations.js';

export const notificationDevices = pgTable(
  'notification_devices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    platform: varchar('platform', { length: 20 }).$type<'web' | 'expo'>().notNull(),
    endpoint: text('endpoint').notNull(),
    subscription: jsonb('subscription').$type<Record<string, any>>().notNull().default({}),
    userAgent: text('user_agent'),
    enabled: boolean('enabled').notNull().default(true),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_notification_devices_user').on(table.userId),
    index('idx_notification_devices_org').on(table.orgId),
    index('idx_notification_devices_platform').on(table.platform),
    index('idx_notification_devices_enabled').on(table.userId, table.enabled),
  ]
);
