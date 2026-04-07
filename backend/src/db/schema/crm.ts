import { pgTable, uuid, varchar, text, numeric, integer, timestamp, index, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { organizations } from './organizations.js';

/** CRM Contacts (Personen) */
export const crmContacts = pgTable(
  'crm_contacts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }).notNull(),
    email: varchar('email', { length: 255 }),
    phone: varchar('phone', { length: 50 }),
    position: varchar('position', { length: 100 }),
    companyId: uuid('company_id').references((): any => crmCompanies.id, { onDelete: 'set null' }),
    notes: text('notes'),
    tags: jsonb('tags').$type<string[]>().default([]),
    ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_crm_contacts_org').on(table.orgId),
    index('idx_crm_contacts_company').on(table.companyId),
  ]
);

/** CRM Companies (Unternehmen) */
export const crmCompanies = pgTable(
  'crm_companies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 300 }).notNull(),
    website: varchar('website', { length: 500 }),
    industry: varchar('industry', { length: 100 }),
    size: varchar('size', { length: 50 }), // 1-10, 11-50, 51-200, 201-500, 500+
    address: text('address'),
    phone: varchar('phone', { length: 50 }),
    notes: text('notes'),
    ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_crm_companies_org').on(table.orgId),
  ]
);

/** CRM Deals (Verkaufschancen / Pipeline) */
export const crmDeals = pgTable(
  'crm_deals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 300 }).notNull(),
    value: numeric('value', { precision: 12, scale: 2 }),
    currency: varchar('currency', { length: 3 }).default('EUR'),
    stage: varchar('stage', { length: 50 }).notNull().default('lead'),
    probability: integer('probability').default(0), // 0-100%
    contactId: uuid('contact_id').references(() => crmContacts.id, { onDelete: 'set null' }),
    companyId: uuid('company_id').references(() => crmCompanies.id, { onDelete: 'set null' }),
    ownerId: uuid('owner_id').references(() => users.id, { onDelete: 'set null' }),
    expectedCloseDate: timestamp('expected_close_date', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_crm_deals_org').on(table.orgId),
    index('idx_crm_deals_stage').on(table.stage),
    index('idx_crm_deals_owner').on(table.ownerId),
  ]
);

/** CRM Activities (Aktivitäten/Notizen zu Deals/Kontakten) */
export const crmActivities = pgTable(
  'crm_activities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 30 }).notNull(), // call, email, meeting, note
    title: varchar('title', { length: 300 }).notNull(),
    description: text('description'),
    contactId: uuid('contact_id').references(() => crmContacts.id, { onDelete: 'cascade' }),
    dealId: uuid('deal_id').references(() => crmDeals.id, { onDelete: 'cascade' }),
    companyId: uuid('company_id').references(() => crmCompanies.id, { onDelete: 'cascade' }),
    createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
    activityDate: timestamp('activity_date', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_crm_activities_contact').on(table.contactId),
    index('idx_crm_activities_deal').on(table.dealId),
  ]
);
