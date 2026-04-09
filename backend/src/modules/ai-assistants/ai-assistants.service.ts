import { and, count, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../config/database.js';
import {
  aiAssistantAssignments,
  aiAssistants,
  aiChatMessages,
  aiChatSessions,
  aiProviders,
} from '../../db/schema/ai-assistants.js';
import { users } from '../../db/schema/users.js';
import { decrypt, encrypt } from '../../lib/encryption.js';
import { ConflictError, ForbiddenError, NotFoundError } from '../../lib/errors.js';

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function ensureUserInOrg(userId: string, orgId: string) {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.id, userId), eq(users.orgId, orgId)))
    .limit(1);

  if (!user) {
    throw new NotFoundError('Benutzer nicht gefunden');
  }
}

export async function listProviders(orgId: string) {
  return db
    .select({
      id: aiProviders.id,
      name: aiProviders.name,
      type: aiProviders.type,
      isActive: aiProviders.isActive,
      createdAt: aiProviders.createdAt,
      updatedAt: aiProviders.updatedAt,
    })
    .from(aiProviders)
    .where(eq(aiProviders.orgId, orgId))
    .orderBy(aiProviders.createdAt);
}

export async function createProvider(
  orgId: string,
  data: { name: string; type: string; apiKey: string },
) {
  const [provider] = await db
    .insert(aiProviders)
    .values({
      orgId,
      name: data.name.trim(),
      type: data.type,
      apiKeyEncrypted: encrypt(data.apiKey),
    })
    .returning();

  return {
    id: provider.id,
    name: provider.name,
    type: provider.type,
    isActive: provider.isActive,
  };
}

export async function deleteProvider(orgId: string, providerId: string) {
  const [provider] = await db
    .select({ id: aiProviders.id })
    .from(aiProviders)
    .where(and(eq(aiProviders.id, providerId), eq(aiProviders.orgId, orgId)))
    .limit(1);

  if (!provider) {
    throw new NotFoundError('Provider nicht gefunden');
  }

  await db.delete(aiProviders).where(eq(aiProviders.id, providerId));
}

export async function listAssistants(orgId: string) {
  return db
    .select({
      id: aiAssistants.id,
      name: aiAssistants.name,
      slug: aiAssistants.slug,
      description: aiAssistants.description,
      model: aiAssistants.model,
      avatarUrl: aiAssistants.avatarUrl,
      openingMessage: aiAssistants.openingMessage,
      responseStructure: aiAssistants.responseStructure,
      isActive: aiAssistants.isActive,
      createdAt: aiAssistants.createdAt,
      updatedAt: aiAssistants.updatedAt,
    })
    .from(aiAssistants)
    .where(eq(aiAssistants.orgId, orgId))
    .orderBy(aiAssistants.createdAt);
}

export async function getAssistantById(id: string, orgId: string) {
  const [assistant] = await db
    .select()
    .from(aiAssistants)
    .where(and(eq(aiAssistants.id, id), eq(aiAssistants.orgId, orgId)))
    .limit(1);

  if (!assistant) {
    throw new NotFoundError('Assistent nicht gefunden');
  }

  return assistant;
}

export async function createAssistant(orgId: string, data: Record<string, unknown>) {
  const name = String(data.name ?? '').trim();
  const providerId = String(data.providerId ?? '');

  const [provider] = await db
    .select({ id: aiProviders.id })
    .from(aiProviders)
    .where(and(eq(aiProviders.id, providerId), eq(aiProviders.orgId, orgId), eq(aiProviders.isActive, true)))
    .limit(1);

  if (!provider) {
    throw new NotFoundError('Aktiver Provider nicht gefunden');
  }

  let slug = slugify(name);
  const [existing] = await db
    .select({ id: aiAssistants.id })
    .from(aiAssistants)
    .where(and(eq(aiAssistants.orgId, orgId), eq(aiAssistants.slug, slug)))
    .limit(1);

  if (existing) {
    slug = `${slug}-${Date.now()}`;
  }

  const [assistant] = await db
    .insert(aiAssistants)
    .values({
      orgId,
      providerId,
      name,
      slug,
      description: typeof data.description === 'string' ? data.description.trim() || null : null,
      model: String(data.model ?? ''),
      systemPrompt: typeof data.systemPrompt === 'string' ? data.systemPrompt.trim() || null : null,
      temperature: data.temperature !== undefined ? String(data.temperature) : undefined,
      maxTokens: typeof data.maxTokens === 'number' ? data.maxTokens : undefined,
      topP: data.topP !== undefined ? String(data.topP) : undefined,
      tone: typeof data.tone === 'string' ? data.tone : undefined,
      language: typeof data.language === 'string' ? data.language : undefined,
      openingMessage: typeof data.openingMessage === 'string' ? data.openingMessage.trim() || null : null,
      responseStructure: typeof data.responseStructure === 'string' ? data.responseStructure.trim() || null : null,
      avatarUrl: typeof data.avatarUrl === 'string' ? data.avatarUrl.trim() || null : null,
      forbiddenTopics: Array.isArray(data.forbiddenTopics)
        ? data.forbiddenTopics.filter((topic): topic is string => typeof topic === 'string' && topic.trim().length > 0)
        : undefined,
    })
    .returning();

  return assistant;
}

export async function updateAssistant(id: string, orgId: string, data: Record<string, unknown>) {
  await getAssistantById(id, orgId);

  const updateData: Record<string, unknown> = { updatedAt: new Date() };

  if (data.providerId !== undefined) {
    const providerId = String(data.providerId);
    const [provider] = await db
      .select({ id: aiProviders.id })
      .from(aiProviders)
      .where(and(eq(aiProviders.id, providerId), eq(aiProviders.orgId, orgId)))
      .limit(1);

    if (!provider) {
      throw new NotFoundError('Provider nicht gefunden');
    }
    updateData.providerId = providerId;
  }

  if (data.name !== undefined) updateData.name = String(data.name).trim();
  if (data.description !== undefined) updateData.description = String(data.description).trim() || null;
  if (data.model !== undefined) updateData.model = String(data.model);
  if (data.systemPrompt !== undefined) updateData.systemPrompt = String(data.systemPrompt).trim() || null;
  if (data.maxTokens !== undefined) updateData.maxTokens = data.maxTokens;
  if (data.temperature !== undefined) updateData.temperature = String(data.temperature);
  if (data.topP !== undefined) updateData.topP = String(data.topP);
  if (data.tone !== undefined) updateData.tone = String(data.tone);
  if (data.language !== undefined) updateData.language = String(data.language);
  if (data.openingMessage !== undefined) updateData.openingMessage = String(data.openingMessage).trim() || null;
  if (data.responseStructure !== undefined) updateData.responseStructure = String(data.responseStructure).trim() || null;
  if (data.avatarUrl !== undefined) updateData.avatarUrl = String(data.avatarUrl).trim() || null;
  if (data.isActive !== undefined) updateData.isActive = Boolean(data.isActive);
  if (data.forbiddenTopics !== undefined) {
    updateData.forbiddenTopics = Array.isArray(data.forbiddenTopics)
      ? data.forbiddenTopics.filter((topic): topic is string => typeof topic === 'string' && topic.trim().length > 0)
      : [];
  }

  const [updated] = await db
    .update(aiAssistants)
    .set(updateData)
    .where(eq(aiAssistants.id, id))
    .returning();

  if (!updated) {
    throw new NotFoundError('Assistent nicht gefunden');
  }

  return updated;
}

export async function deleteAssistant(id: string, orgId: string) {
  await getAssistantById(id, orgId);
  await db.delete(aiAssistants).where(eq(aiAssistants.id, id));
}

export async function getMyAssistants(userId: string, orgId: string) {
  return db
    .select({
      id: aiAssistants.id,
      name: aiAssistants.name,
      slug: aiAssistants.slug,
      description: aiAssistants.description,
      avatarUrl: aiAssistants.avatarUrl,
      model: aiAssistants.model,
      openingMessage: aiAssistants.openingMessage,
      sortOrder: aiAssistantAssignments.sortOrder,
    })
    .from(aiAssistantAssignments)
    .innerJoin(aiAssistants, eq(aiAssistantAssignments.assistantId, aiAssistants.id))
    .where(
      and(
        eq(aiAssistantAssignments.userId, userId),
        eq(aiAssistants.orgId, orgId),
        eq(aiAssistants.isActive, true),
      ),
    )
    .orderBy(aiAssistantAssignments.sortOrder, aiAssistants.name);
}

export async function assignAssistant(orgId: string, assistantId: string, userId: string) {
  await getAssistantById(assistantId, orgId);
  await ensureUserInOrg(userId, orgId);

  const [existing] = await db
    .select({ id: aiAssistantAssignments.id })
    .from(aiAssistantAssignments)
    .where(and(eq(aiAssistantAssignments.assistantId, assistantId), eq(aiAssistantAssignments.userId, userId)))
    .limit(1);

  if (existing) {
    return;
  }

  const [lastAssignment] = await db
    .select({ sortOrder: aiAssistantAssignments.sortOrder })
    .from(aiAssistantAssignments)
    .where(eq(aiAssistantAssignments.userId, userId))
    .orderBy(desc(aiAssistantAssignments.sortOrder))
    .limit(1);

  await db.insert(aiAssistantAssignments).values({
    assistantId,
    userId,
    sortOrder: (lastAssignment?.sortOrder ?? -1) + 1,
  });
}

export async function unassignAssistant(orgId: string, assistantId: string, userId: string) {
  await getAssistantById(assistantId, orgId);
  await ensureUserInOrg(userId, orgId);

  await db
    .delete(aiAssistantAssignments)
    .where(and(eq(aiAssistantAssignments.assistantId, assistantId), eq(aiAssistantAssignments.userId, userId)));
}

export async function replaceAssignments(orgId: string, userId: string, assistantIds: string[]) {
  await ensureUserInOrg(userId, orgId);

  if (assistantIds.length > 0) {
    const existingAssistants = await db
      .select({ id: aiAssistants.id })
      .from(aiAssistants)
      .where(and(eq(aiAssistants.orgId, orgId), inArray(aiAssistants.id, assistantIds)));

    if (existingAssistants.length !== assistantIds.length) {
      throw new ConflictError('Mindestens ein Assistent gehoert nicht zur Organisation');
    }
  }

  await db.delete(aiAssistantAssignments).where(eq(aiAssistantAssignments.userId, userId));

  if (assistantIds.length === 0) {
    return;
  }

  await db.insert(aiAssistantAssignments).values(
    assistantIds.map((assistantId, index) => ({
      assistantId,
      userId,
      sortOrder: index,
    })),
  );
}

export async function getAssignedAssistantsForUser(orgId: string, userId: string) {
  await ensureUserInOrg(userId, orgId);

  return db
    .select({
      id: aiAssistants.id,
      name: aiAssistants.name,
    })
    .from(aiAssistantAssignments)
    .innerJoin(aiAssistants, eq(aiAssistantAssignments.assistantId, aiAssistants.id))
    .where(and(eq(aiAssistantAssignments.userId, userId), eq(aiAssistants.orgId, orgId)))
    .orderBy(aiAssistantAssignments.sortOrder, aiAssistants.name);
}

export async function createSession(orgId: string, assistantId: string, userId: string) {
  const [assignment] = await db
    .select({ id: aiAssistantAssignments.id })
    .from(aiAssistantAssignments)
    .innerJoin(aiAssistants, eq(aiAssistantAssignments.assistantId, aiAssistants.id))
    .where(
      and(
        eq(aiAssistantAssignments.assistantId, assistantId),
        eq(aiAssistantAssignments.userId, userId),
        eq(aiAssistants.orgId, orgId),
        eq(aiAssistants.isActive, true),
      ),
    )
    .limit(1);

  if (!assignment) {
    throw new ForbiddenError('Assistent nicht zugewiesen');
  }

  const [session] = await db
    .insert(aiChatSessions)
    .values({
      assistantId,
      userId,
      title: 'Neuer Chat',
    })
    .returning();

  return session;
}

export async function getMySessions(userId: string, assistantId?: string) {
  const filters = [eq(aiChatSessions.userId, userId)];
  if (assistantId) {
    filters.push(eq(aiChatSessions.assistantId, assistantId));
  }

  return db
    .select()
    .from(aiChatSessions)
    .where(and(...filters))
    .orderBy(desc(aiChatSessions.updatedAt));
}

export async function getSessionForUser(sessionId: string, userId: string) {
  const [session] = await db
    .select()
    .from(aiChatSessions)
    .where(and(eq(aiChatSessions.id, sessionId), eq(aiChatSessions.userId, userId)))
    .limit(1);

  return session ?? null;
}

export async function getSessionMessages(sessionId: string, userId: string) {
  const session = await getSessionForUser(sessionId, userId);
  if (!session) {
    throw new NotFoundError('Chat-Session nicht gefunden');
  }

  return db
    .select()
    .from(aiChatMessages)
    .where(eq(aiChatMessages.sessionId, sessionId))
    .orderBy(aiChatMessages.createdAt);
}

export async function addMessage(
  sessionId: string,
  role: 'user' | 'assistant',
  content: string,
  options?: {
    tokenCount?: number;
    modelUsed?: string;
    latencyMs?: number;
  },
) {
  const [message] = await db
    .insert(aiChatMessages)
    .values({
      sessionId,
      role,
      content,
      tokenCount: options?.tokenCount ?? null,
      modelUsed: options?.modelUsed ?? null,
      latencyMs: options?.latencyMs ?? null,
    })
    .returning();

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  const [userMessageCount] = await db
    .select({ count: count() })
    .from(aiChatMessages)
    .where(and(eq(aiChatMessages.sessionId, sessionId), eq(aiChatMessages.role, 'user')))
    .limit(1);

  if (role === 'user' && userMessageCount?.count === 1) {
    updateData.title = content.trim().slice(0, 80);
  }

  await db.update(aiChatSessions).set(updateData).where(eq(aiChatSessions.id, sessionId));
  return message;
}

export async function deleteSession(sessionId: string, userId: string) {
  const session = await getSessionForUser(sessionId, userId);
  if (!session) {
    throw new NotFoundError('Chat-Session nicht gefunden');
  }

  await db.delete(aiChatSessions).where(eq(aiChatSessions.id, sessionId));
}

export async function ensureAssignedAssistant(orgId: string, assistantId: string, userId: string) {
  const [assignment] = await db
    .select({ assistantId: aiAssistantAssignments.assistantId })
    .from(aiAssistantAssignments)
    .innerJoin(aiAssistants, eq(aiAssistantAssignments.assistantId, aiAssistants.id))
    .where(
      and(
        eq(aiAssistantAssignments.assistantId, assistantId),
        eq(aiAssistantAssignments.userId, userId),
        eq(aiAssistants.orgId, orgId),
        eq(aiAssistants.isActive, true),
      ),
    )
    .limit(1);

  if (!assignment) {
    throw new ForbiddenError('Assistent nicht zugewiesen');
  }
}

export async function getProviderApiKey(orgId: string, providerId: string): Promise<{ type: string; apiKey: string }> {
  const [provider] = await db
    .select({
      type: aiProviders.type,
      apiKeyEncrypted: aiProviders.apiKeyEncrypted,
      isActive: aiProviders.isActive,
    })
    .from(aiProviders)
    .where(and(eq(aiProviders.id, providerId), eq(aiProviders.orgId, orgId)))
    .limit(1);

  if (!provider) {
    throw new NotFoundError('Provider nicht gefunden');
  }

  if (!provider.isActive) {
    throw new ForbiddenError('Provider ist deaktiviert');
  }

  return {
    type: provider.type,
    apiKey: decrypt(provider.apiKeyEncrypted),
  };
}
