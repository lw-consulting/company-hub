import { pgTable, uuid, varchar, text, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { organizations } from './organizations.js';

export const calendarEvents = pgTable(
  'calendar_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 300 }).notNull(),
    description: text('description'),
    location: varchar('location', { length: 300 }),
    startAt: timestamp('start_at', { withTimezone: true }).notNull(),
    endAt: timestamp('end_at', { withTimezone: true }).notNull(),
    allDay: boolean('all_day').notNull().default(false),
    recurrenceRule: text('recurrence_rule'), // iCal RRULE
    color: varchar('color', { length: 7 }),
    // private = nur User, team = Team/Abteilung, org = alle
    visibility: varchar('visibility', { length: 20 }).notNull().default('private'),
    // manual = manuell erstellt, leave_request = aus Urlaubsantrag
    sourceType: varchar('source_type', { length: 30 }).notNull().default('manual'),
    sourceId: uuid('source_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_calendar_events_org').on(table.orgId),
    index('idx_calendar_events_dates').on(table.startAt, table.endAt),
    index('idx_calendar_events_creator').on(table.createdBy),
    index('idx_calendar_events_source').on(table.sourceType, table.sourceId),
  ]
);

export const calendarEventAttendees = pgTable(
  'calendar_event_attendees',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => calendarEvents.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_cal_attendees_event').on(table.eventId),
    index('idx_cal_attendees_user').on(table.userId),
  ]
);
