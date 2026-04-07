import { pgTable, uuid, varchar, text, boolean, timestamp, index, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { organizations } from './organizations.js';

/** Webhooks for external integrations (Zapier, Make, N8n, ERP) */
export const webhooks = pgTable(
  'webhooks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    url: text('url').notNull(),
    secretEncrypted: text('secret_encrypted').notNull(), // HMAC signing secret
    events: jsonb('events').$type<string[]>().notNull().default([]), // e.g. ['leave.approved', 'task.created']
    isActive: boolean('is_active').notNull().default(true),
    createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
    lastTriggeredAt: timestamp('last_triggered_at', { withTimezone: true }),
    failCount: varchar('fail_count', { length: 10 }).notNull().default('0'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_webhooks_org').on(table.orgId),
  ]
);

/** API Keys for external tool access */
export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    keyHash: text('key_hash').notNull(), // SHA-256 hash of the key
    keyPrefix: varchar('key_prefix', { length: 12 }).notNull(), // First 8 chars for identification (e.g. "ch_live_ab")
    scopes: jsonb('scopes').$type<string[]>().notNull().default([]), // e.g. ['read:users', 'write:tasks']
    isActive: boolean('is_active').notNull().default(true),
    createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_api_keys_org').on(table.orgId),
    index('idx_api_keys_prefix').on(table.keyPrefix),
  ]
);

/** Webhook delivery log */
export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    webhookId: uuid('webhook_id').notNull().references(() => webhooks.id, { onDelete: 'cascade' }),
    event: varchar('event', { length: 100 }).notNull(),
    payload: jsonb('payload'),
    statusCode: varchar('status_code', { length: 5 }),
    responseBody: text('response_body'),
    success: boolean('success').notNull().default(false),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_webhook_deliveries_webhook').on(table.webhookId),
  ]
);
