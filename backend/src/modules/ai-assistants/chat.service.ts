import { and, eq } from 'drizzle-orm';
import { db } from '../../config/database.js';
import { aiChatSessions } from '../../db/schema/ai-assistants.js';
import { users } from '../../db/schema/users.js';
import { createAdapter, type ChatMessage } from './adapters/index.js';
import {
  addMessage,
  ensureAssignedAssistant,
  getAssistantById,
  getProviderApiKey,
  getSessionForUser,
  getSessionMessages,
} from './ai-assistants.service.js';
import { getIncludedDocuments, searchRelevantChunks, searchRelevantPassages } from './knowledge.service.js';

const FULL_DOCUMENT_LIMIT = 12_000;
const FULL_DOCUMENT_BUDGET = 32_000;
const SEARCH_LIMIT = 6;

function buildEmployeeContextPrompt(user: {
  firstName: string;
  lastName: string;
  department: string | null;
  position: string | null;
}) {
  const lines = [
    '--- MITARBEITERKONTEXT ---',
    `Name: ${user.firstName} ${user.lastName}`,
  ];

  if (user.department) {
    lines.push(`Abteilung: ${user.department}`);
  }
  if (user.position) {
    lines.push(`Position: ${user.position}`);
  }

  lines.push('Nutze diesen Kontext nur, wenn er fuer die Antwort wirklich hilfreich ist.');
  return lines.join('\n');
}

async function buildSystemPrompt(assistantId: string, orgId: string, userId: string) {
  const assistant = await getAssistantById(assistantId, orgId);
  let prompt = assistant.systemPrompt ?? '';

  const [user] = await db
    .select({
      firstName: users.firstName,
      lastName: users.lastName,
      department: users.department,
      position: users.position,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (user) {
    prompt = `${prompt}\n\n${buildEmployeeContextPrompt(user)}`.trim();
  }

  if (assistant.responseStructure) {
    prompt += `\n\nAntwort-Struktur:\n${assistant.responseStructure}`;
  }

  const forbiddenTopics = Array.isArray(assistant.forbiddenTopics)
    ? assistant.forbiddenTopics.filter((topic): topic is string => typeof topic === 'string' && topic.trim().length > 0)
    : [];

  if (forbiddenTopics.length > 0) {
    prompt += `\n\nVerbotene Themen:\n${forbiddenTopics.map((topic) => `- ${topic}`).join('\n')}`;
  }

  const includedDocuments = await getIncludedDocuments(assistantId);
  const fullDocuments: Array<{ filename: string; content: string }> = [];
  const searchDocuments: Array<{ filename: string; content: string }> = [];
  let injectedCharacters = 0;

  for (const document of includedDocuments) {
    const withinSingleLimit = document.content.length <= FULL_DOCUMENT_LIMIT;
    const withinBudget = injectedCharacters + document.content.length <= FULL_DOCUMENT_BUDGET;

    if (withinSingleLimit && withinBudget) {
      fullDocuments.push(document);
      injectedCharacters += document.content.length;
    } else {
      searchDocuments.push(document);
    }
  }

  return {
    assistant,
    prompt,
    fullDocuments,
    searchDocuments,
  };
}

function appendKnowledgeContext(basePrompt: string, documents: Array<{ filename: string; content: string }>) {
  if (documents.length === 0) {
    return basePrompt;
  }

  let prompt = `${basePrompt}\n\n--- WISSENSBASIS ---\nNutze die folgenden Dokumente als internen Kontext. Zitiere relevante Werte moeglichst praezise.\n`;
  for (const document of documents) {
    prompt += `\n[${document.filename}]\n${document.content}\n`;
  }
  return prompt;
}

export async function* streamAssistantReply(params: {
  orgId: string;
  assistantId: string;
  userId: string;
  message: string;
  sessionId?: string;
  fileContext?: string;
}): AsyncIterable<
  | { type: 'session'; sessionId: string }
  | { type: 'chunk'; content: string }
  | { type: 'done'; sessionId: string }
  | { type: 'error'; error: string }
> {
  await ensureAssignedAssistant(params.orgId, params.assistantId, params.userId);

  let session = params.sessionId
    ? await getSessionForUser(params.sessionId, params.userId)
    : null;

  if (session && session.assistantId !== params.assistantId) {
    yield { type: 'error', error: 'Session gehoert nicht zu diesem Assistenten' };
    return;
  }

  if (!session) {
    const [createdSession] = await db
      .insert(aiChatSessions)
      .values({
        assistantId: params.assistantId,
        userId: params.userId,
        title: 'Neuer Chat',
      })
      .returning();
    session = createdSession;
  }

  yield { type: 'session', sessionId: session.id };

  await addMessage(session.id, 'user', params.message);

  const history = await getSessionMessages(session.id, params.userId);
  const { assistant, prompt, fullDocuments, searchDocuments } = await buildSystemPrompt(
    params.assistantId,
    params.orgId,
    params.userId,
  );

  let systemPrompt = appendKnowledgeContext(prompt, fullDocuments);

  if (searchDocuments.length > 0) {
    const relevantPassages = await searchRelevantPassages(params.assistantId, params.message, SEARCH_LIMIT);
    const relevantChunks = relevantPassages.length > 0
      ? relevantPassages
      : await searchRelevantChunks(params.assistantId, params.message, SEARCH_LIMIT);

    if (relevantChunks.length > 0) {
      systemPrompt += '\n\nWeitere relevante Wissensbasis-Auszuege:\n';
      for (const chunk of relevantChunks) {
        systemPrompt += `\n[${chunk.filename}]\n${chunk.content}\n`;
      }
    }
  }

  if (params.fileContext) {
    systemPrompt += `\n\n--- DATEIKONTEXT DES NUTZERS ---\n${params.fileContext}\n--- ENDE DATEIKONTEXT ---`;
  }

  const provider = await getProviderApiKey(params.orgId, assistant.providerId);
  const adapter = createAdapter(provider.type, provider.apiKey);
  const messages: ChatMessage[] = [];

  if (systemPrompt.trim()) {
    messages.push({ role: 'system', content: systemPrompt.trim() });
  }

  for (const message of history) {
    if (message.role === 'user' || message.role === 'assistant') {
      messages.push({
        role: message.role,
        content: message.content,
      });
    }
  }

  const startedAt = Date.now();
  let fullResponse = '';

  try {
    for await (const chunk of adapter.chatStream(messages, {
      model: assistant.model,
      temperature: assistant.temperature ? Number(assistant.temperature) : 0.7,
      maxTokens: assistant.maxTokens ?? 2048,
      topP: assistant.topP ? Number(assistant.topP) : 1,
    })) {
      if (chunk.content) {
        fullResponse += chunk.content;
        yield { type: 'chunk', content: chunk.content };
      }

      if (chunk.done) {
        break;
      }
    }
  } catch (error) {
    yield { type: 'error', error: error instanceof Error ? error.message : 'Stream fehlgeschlagen' };
    return;
  }

  if (fullResponse.trim()) {
    await addMessage(session.id, 'assistant', fullResponse, {
      modelUsed: assistant.model,
      latencyMs: Date.now() - startedAt,
    });
  }

  yield { type: 'done', sessionId: session.id };
}

export async function getAssistantSessionHistory(params: {
  orgId: string;
  assistantId: string;
  sessionId: string;
  userId: string;
}) {
  await ensureAssignedAssistant(params.orgId, params.assistantId, params.userId);
  return getSessionMessages(params.sessionId, params.userId);
}

export async function validateSessionBelongsToAssistant(sessionId: string, assistantId: string, userId: string) {
  const [session] = await db
    .select({ id: aiChatSessions.id })
    .from(aiChatSessions)
    .where(and(eq(aiChatSessions.id, sessionId), eq(aiChatSessions.assistantId, assistantId), eq(aiChatSessions.userId, userId)))
    .limit(1);

  return Boolean(session);
}
