import { pgTable, uuid, varchar, text, boolean, integer, numeric, timestamp, index, jsonb } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { organizations } from './organizations.js';

/** AI Provider (OpenAI, Anthropic, Gemini, etc.) */
export const aiProviders = pgTable('ai_providers', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  type: varchar('type', { length: 30 }).notNull(), // openai, anthropic, gemini, perplexity
  apiKeyEncrypted: text('api_key_encrypted').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** AI Assistant configuration */
export const aiAssistants = pgTable(
  'ai_assistants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    providerId: uuid('provider_id').notNull().references(() => aiProviders.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 200 }).notNull(),
    slug: varchar('slug', { length: 100 }).notNull(),
    description: text('description'),
    avatarUrl: text('avatar_url'),
    model: varchar('model', { length: 100 }).notNull(),
    systemPrompt: text('system_prompt'),
    temperature: numeric('temperature', { precision: 3, scale: 2 }).default('0.70'),
    maxTokens: integer('max_tokens').default(2048),
    tone: varchar('tone', { length: 50 }).default('professional'),
    language: varchar('language', { length: 10 }).default('de'),
    openingMessage: text('opening_message'),
    forbiddenTopics: jsonb('forbidden_topics').$type<string[]>().default([]),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_ai_assistants_org').on(table.orgId),
    index('idx_ai_assistants_slug').on(table.slug),
  ]
);

/** Which users can access which assistants */
export const aiAssistantAssignments = pgTable(
  'ai_assistant_assignments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    assistantId: uuid('assistant_id').notNull().references(() => aiAssistants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_ai_assignments_user').on(table.userId),
  ]
);

/** Chat sessions */
export const aiChatSessions = pgTable(
  'ai_chat_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    assistantId: uuid('assistant_id').notNull().references(() => aiAssistants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 300 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_ai_sessions_user').on(table.userId),
    index('idx_ai_sessions_assistant').on(table.assistantId),
  ]
);

/** Chat messages */
export const aiChatMessages = pgTable(
  'ai_chat_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id').notNull().references(() => aiChatSessions.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 20 }).notNull(), // user, assistant, system
    content: text('content').notNull(),
    tokenCount: integer('token_count'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_ai_messages_session').on(table.sessionId),
  ]
);
