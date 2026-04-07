import { pgTable, uuid, varchar, text, integer, timestamp } from 'drizzle-orm/pg-core';

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 200 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  logoUrl: text('logo_url'),
  primaryColor: varchar('primary_color', { length: 7 }).notNull().default('#6366f1'),
  secondaryColor: varchar('secondary_color', { length: 7 }).notNull().default('#1e1b4b'),
  accentColor: varchar('accent_color', { length: 7 }).notNull().default('#f59e0b'),
  timezone: varchar('timezone', { length: 50 }).notNull().default('Europe/Vienna'),
  locale: varchar('locale', { length: 5 }).notNull().default('de'),
  coreHoursStart: varchar('core_hours_start', { length: 5 }),
  coreHoursEnd: varchar('core_hours_end', { length: 5 }),
  breakAfterMinutes: integer('break_after_minutes').notNull().default(360),
  breakDurationMinutes: integer('break_duration_minutes').notNull().default(30),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
