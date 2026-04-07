import { eq, and, desc } from 'drizzle-orm';
import { db } from '../../config/database.js';
import { aiProviders, aiAssistants, aiAssistantAssignments, aiChatSessions, aiChatMessages } from '../../db/schema/ai-assistants.js';
import { users } from '../../db/schema/users.js';
import { encrypt, decrypt } from '../../lib/encryption.js';
import { NotFoundError } from '../../lib/errors.js';

// --- Providers ---

export async function listProviders(orgId: string) {
  return db.select({
    id: aiProviders.id,
    name: aiProviders.name,
    type: aiProviders.type,
    isActive: aiProviders.isActive,
    createdAt: aiProviders.createdAt,
  }).from(aiProviders).where(eq(aiProviders.orgId, orgId));
}

export async function createProvider(orgId: string, data: { name: string; type: string; apiKey: string }) {
  const [provider] = await db.insert(aiProviders).values({
    orgId,
    name: data.name,
    type: data.type,
    apiKeyEncrypted: encrypt(data.apiKey),
  }).returning();
  return { id: provider.id, name: provider.name, type: provider.type };
}

export async function deleteProvider(providerId: string) {
  await db.delete(aiProviders).where(eq(aiProviders.id, providerId));
}

// --- Assistants ---

export async function listAssistants(orgId: string) {
  return db.select({
    id: aiAssistants.id,
    name: aiAssistants.name,
    slug: aiAssistants.slug,
    description: aiAssistants.description,
    model: aiAssistants.model,
    avatarUrl: aiAssistants.avatarUrl,
    isActive: aiAssistants.isActive,
    createdAt: aiAssistants.createdAt,
  }).from(aiAssistants).where(eq(aiAssistants.orgId, orgId));
}

export async function getAssistantById(id: string) {
  const [assistant] = await db.select().from(aiAssistants).where(eq(aiAssistants.id, id)).limit(1);
  if (!assistant) throw new NotFoundError('Assistent nicht gefunden');
  return assistant;
}

export async function createAssistant(orgId: string, data: any) {
  const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const [assistant] = await db.insert(aiAssistants).values({
    orgId,
    providerId: data.providerId,
    name: data.name,
    slug,
    description: data.description,
    model: data.model,
    systemPrompt: data.systemPrompt,
    temperature: data.temperature?.toString(),
    maxTokens: data.maxTokens,
    tone: data.tone,
    language: data.language,
    openingMessage: data.openingMessage,
    avatarUrl: data.avatarUrl,
    forbiddenTopics: data.forbiddenTopics || [],
  }).returning();
  return assistant;
}

export async function updateAssistant(id: string, data: any) {
  const updateData: Record<string, any> = { updatedAt: new Date() };
  const fields = ['name', 'description', 'model', 'systemPrompt', 'maxTokens', 'tone', 'language', 'openingMessage', 'avatarUrl', 'isActive', 'providerId'];
  for (const f of fields) {
    if (data[f] !== undefined) updateData[f] = data[f];
  }
  if (data.temperature !== undefined) updateData.temperature = data.temperature.toString();
  if (data.forbiddenTopics !== undefined) updateData.forbiddenTopics = data.forbiddenTopics;

  const [updated] = await db.update(aiAssistants).set(updateData).where(eq(aiAssistants.id, id)).returning();
  if (!updated) throw new NotFoundError('Assistent nicht gefunden');
  return updated;
}

export async function deleteAssistant(id: string) {
  await db.delete(aiAssistants).where(eq(aiAssistants.id, id));
}

// --- Assignments ---

export async function getMyAssistants(userId: string) {
  const assignments = await db
    .select({
      id: aiAssistants.id,
      name: aiAssistants.name,
      slug: aiAssistants.slug,
      description: aiAssistants.description,
      avatarUrl: aiAssistants.avatarUrl,
      model: aiAssistants.model,
      openingMessage: aiAssistants.openingMessage,
    })
    .from(aiAssistantAssignments)
    .innerJoin(aiAssistants, eq(aiAssistantAssignments.assistantId, aiAssistants.id))
    .where(and(eq(aiAssistantAssignments.userId, userId), eq(aiAssistants.isActive, true)));
  return assignments;
}

export async function assignAssistant(assistantId: string, userId: string) {
  await db.insert(aiAssistantAssignments).values({ assistantId, userId }).onConflictDoNothing();
}

export async function unassignAssistant(assistantId: string, userId: string) {
  await db.delete(aiAssistantAssignments).where(
    and(eq(aiAssistantAssignments.assistantId, assistantId), eq(aiAssistantAssignments.userId, userId))
  );
}

// --- Chat ---

export async function createSession(assistantId: string, userId: string) {
  const [session] = await db.insert(aiChatSessions).values({
    assistantId, userId, title: 'Neuer Chat',
  }).returning();
  return session;
}

export async function getMySessions(userId: string, assistantId: string) {
  return db.select().from(aiChatSessions)
    .where(and(eq(aiChatSessions.userId, userId), eq(aiChatSessions.assistantId, assistantId)))
    .orderBy(desc(aiChatSessions.updatedAt));
}

export async function getSessionMessages(sessionId: string) {
  return db.select().from(aiChatMessages)
    .where(eq(aiChatMessages.sessionId, sessionId))
    .orderBy(aiChatMessages.createdAt);
}

export async function addMessage(sessionId: string, role: string, content: string, tokenCount?: number) {
  const [msg] = await db.insert(aiChatMessages).values({
    sessionId, role, content, tokenCount,
  }).returning();

  // Update session timestamp
  await db.update(aiChatSessions).set({ updatedAt: new Date() }).where(eq(aiChatSessions.id, sessionId));
  return msg;
}

export async function deleteSession(sessionId: string, userId: string) {
  await db.delete(aiChatSessions).where(
    and(eq(aiChatSessions.id, sessionId), eq(aiChatSessions.userId, userId))
  );
}

/**
 * Get decrypted API key for a provider.
 * Used internally for making API calls to LLM providers.
 */
export async function getProviderApiKey(providerId: string): Promise<{ type: string; apiKey: string }> {
  const [provider] = await db.select({
    type: aiProviders.type,
    apiKeyEncrypted: aiProviders.apiKeyEncrypted,
  }).from(aiProviders).where(eq(aiProviders.id, providerId)).limit(1);

  if (!provider) throw new NotFoundError('Provider nicht gefunden');
  return { type: provider.type, apiKey: decrypt(provider.apiKeyEncrypted) };
}
