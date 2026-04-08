import { pgTable, uuid, integer, boolean, text, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { organizations } from './organizations.js';

export const timeEntries = pgTable(
  'time_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    clockIn: timestamp('clock_in', { withTimezone: true }).notNull(),
    clockOut: timestamp('clock_out', { withTimezone: true }),
    breakMinutes: integer('break_minutes').notNull().default(0),
    autoBreakApplied: boolean('auto_break_applied').notNull().default(false),
    notes: text('notes'),
    // For corrections by supervisor
    correctedBy: uuid('corrected_by').references(() => users.id, { onDelete: 'set null' }),
    correctionNote: text('correction_note'),
    // User self-edited tracking
    userEdited: boolean('user_edited').notNull().default(false),
    userEditedAt: timestamp('user_edited_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_time_entries_user_date').on(table.userId, table.clockIn),
    index('idx_time_entries_org').on(table.orgId),
  ]
);

export const timeEntryBreaks = pgTable(
  'time_entry_breaks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    timeEntryId: uuid('time_entry_id')
      .notNull()
      .references(() => timeEntries.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_time_entry_breaks_entry').on(table.timeEntryId, table.startedAt),
    index('idx_time_entry_breaks_user').on(table.userId, table.startedAt),
  ],
);
