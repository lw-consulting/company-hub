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
    topP: numeric('top_p', { precision: 3, scale: 2 }).default('1.00'),
    tone: varchar('tone', { length: 50 }).default('professional'),
    language: varchar('language', { length: 10 }).default('de'),
    openingMessage: text('opening_message'),
    responseStructure: text('response_structure'),
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
    sortOrder: integer('sort_order').notNull().default(0),
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
    modelUsed: varchar('model_used', { length: 100 }),
    latencyMs: integer('latency_ms'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_ai_messages_session').on(table.sessionId),
  ]
);

/** Stored text knowledge documents for assistants */
export const aiAssistantDocuments = pgTable(
  'ai_assistant_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    assistantId: uuid('assistant_id').notNull().references(() => aiAssistants.id, { onDelete: 'cascade' }),
    filename: varchar('filename', { length: 500 }).notNull(),
    fileType: varchar('file_type', { length: 30 }).notNull(),
    mimeType: varchar('mime_type', { length: 150 }),
    fileSize: integer('file_size').notNull(),
    textContent: text('text_content').notNull(),
    includeInPrompt: boolean('include_in_prompt').notNull().default(true),
    uploadedBy: uuid('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_ai_documents_assistant').on(table.assistantId),
  ]
);

/** Searchable knowledge chunks per assistant document */
export const aiDocumentChunks = pgTable(
  'ai_document_chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id').notNull().references(() => aiAssistantDocuments.id, { onDelete: 'cascade' }),
    assistantId: uuid('assistant_id').notNull().references(() => aiAssistants.id, { onDelete: 'cascade' }),
    content: text('content').notNull(),
    chunkIndex: integer('chunk_index').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_ai_document_chunks_assistant').on(table.assistantId),
    index('idx_ai_document_chunks_document').on(table.documentId),
  ]
);
