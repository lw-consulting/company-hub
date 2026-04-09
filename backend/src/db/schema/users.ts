import { pgTable, uuid, varchar, text, boolean, integer, numeric, timestamp, index, jsonb } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.js';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: text('password_hash').notNull(),
    role: varchar('role', { length: 20 }).notNull().default('user'),
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }).notNull(),
    avatarUrl: text('avatar_url'),
    department: varchar('department', { length: 100 }),
    position: varchar('position', { length: 100 }),
    phone: varchar('phone', { length: 50 }),
    supervisorId: uuid('supervisor_id').references((): any => users.id, { onDelete: 'set null' }),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    vacationDaysPerYear: integer('vacation_days_per_year').notNull().default(25),
    weeklyTargetHours: numeric('weekly_target_hours', { precision: 5, scale: 2 }).notNull().default('40.00'),
    // Initial balance in minutes (positive = Gutstunden, negative = Minusstunden) carried over at start
    initialBalanceMinutes: integer('initial_balance_minutes').notNull().default(0),
    // Working days as array of weekday numbers (1=Mon, 2=Tue, ..., 7=Sun) — default Mon-Fri
    workingDays: jsonb('working_days').$type<number[]>().notNull().default([1, 2, 3, 4, 5]),
    timeEditsRequireApproval: boolean('time_edits_require_approval').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    refreshToken: text('refresh_token'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_users_email').on(table.email),
    index('idx_users_org').on(table.orgId),
    index('idx_users_supervisor').on(table.supervisorId),
  ]
);
