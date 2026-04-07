import type { FastifyInstance } from 'fastify';
import * as aiService from './ai-assistants.service.js';
import { createAdapter, type ChatMessage } from './adapters/index.js';

export async function aiAssistantsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);
  const modGuard = fastify.requireModule('ai-assistants');

  // --- Providers (admin) ---
  fastify.get('/api/ai/providers', { preHandler: [modGuard, fastify.requireRole('admin')] }, async (req, reply) => {
    const providers = await aiService.listProviders(req.user.orgId);
    return reply.send({ data: providers, statusCode: 200 });
  });

  fastify.post('/api/ai/providers', { preHandler: [modGuard, fastify.requireRole('admin')] }, async (req, reply) => {
    const provider = await aiService.createProvider(req.user.orgId, req.body as any);
    return reply.status(201).send({ data: provider, statusCode: 201 });
  });

  fastify.delete('/api/ai/providers/:id', { preHandler: [modGuard, fastify.requireRole('admin')] }, async (req, reply) => {
    await aiService.deleteProvider((req.params as any).id);
    return reply.send({ data: { message: 'Provider gelöscht' }, statusCode: 200 });
  });

  // --- Assistants (admin) ---
  fastify.get('/api/ai/assistants', { preHandler: [modGuard, fastify.requireRole('admin')] }, async (req, reply) => {
    const assistants = await aiService.listAssistants(req.user.orgId);
    return reply.send({ data: assistants, statusCode: 200 });
  });

  fastify.get('/api/ai/assistants/:id', { preHandler: [modGuard] }, async (req, reply) => {
    const assistant = await aiService.getAssistantById((req.params as any).id);
    return reply.send({ data: assistant, statusCode: 200 });
  });

  fastify.post('/api/ai/assistants', { preHandler: [modGuard, fastify.requireRole('admin')] }, async (req, reply) => {
    const assistant = await aiService.createAssistant(req.user.orgId, req.body);
    return reply.status(201).send({ data: assistant, statusCode: 201 });
  });

  fastify.patch('/api/ai/assistants/:id', { preHandler: [modGuard, fastify.requireRole('admin')] }, async (req, reply) => {
    const assistant = await aiService.updateAssistant((req.params as any).id, req.body);
    return reply.send({ data: assistant, statusCode: 200 });
  });

  fastify.delete('/api/ai/assistants/:id', { preHandler: [modGuard, fastify.requireRole('admin')] }, async (req, reply) => {
    await aiService.deleteAssistant((req.params as any).id);
    return reply.send({ data: { message: 'Assistent gelöscht' }, statusCode: 200 });
  });

  // --- Assignments (admin) ---
  fastify.post('/api/ai/assistants/:id/assign', { preHandler: [modGuard, fastify.requireRole('admin')] }, async (req, reply) => {
    const { userId } = req.body as any;
    await aiService.assignAssistant((req.params as any).id, userId);
    return reply.send({ data: { message: 'Zugewiesen' }, statusCode: 200 });
  });

  fastify.post('/api/ai/assistants/:id/unassign', { preHandler: [modGuard, fastify.requireRole('admin')] }, async (req, reply) => {
    const { userId } = req.body as any;
    await aiService.unassignAssistant((req.params as any).id, userId);
    return reply.send({ data: { message: 'Zuweisung entfernt' }, statusCode: 200 });
  });

  // --- My Assistants (user) ---
  fastify.get('/api/ai/my-assistants', { preHandler: [modGuard] }, async (req, reply) => {
    const assistants = await aiService.getMyAssistants(req.user.sub);
    return reply.send({ data: assistants, statusCode: 200 });
  });

  // --- Chat ---
  fastify.post('/api/ai/chat/sessions', { preHandler: [modGuard] }, async (req, reply) => {
    const { assistantId } = req.body as any;
    const session = await aiService.createSession(assistantId, req.user.sub);
    return reply.status(201).send({ data: session, statusCode: 201 });
  });

  fastify.get('/api/ai/chat/sessions', { preHandler: [modGuard] }, async (req, reply) => {
    const { assistantId } = req.query as any;
    const sessions = await aiService.getMySessions(req.user.sub, assistantId);
    return reply.send({ data: sessions, statusCode: 200 });
  });

  fastify.get('/api/ai/chat/sessions/:id/messages', { preHandler: [modGuard] }, async (req, reply) => {
    const messages = await aiService.getSessionMessages((req.params as any).id);
    return reply.send({ data: messages, statusCode: 200 });
  });

  fastify.post('/api/ai/chat/sessions/:id/messages', { preHandler: [modGuard] }, async (req, reply) => {
    const { content } = req.body as any;
    const sessionId = (req.params as any).id;

    // Save user message
    await aiService.addMessage(sessionId, 'user', content);

    // Get session to find assistant
    const sessionMessages = await aiService.getSessionMessages(sessionId);
    const sessions = await aiService.getMySessions(req.user.sub, '');
    // Find the session to get assistantId
    const { db } = await import('../../config/database.js');
    const { aiChatSessions } = await import('../../db/schema/ai-assistants.js');
    const { eq } = await import('drizzle-orm');
    const [session] = await db.select().from(aiChatSessions).where(eq(aiChatSessions.id, sessionId)).limit(1);

    if (!session) {
      return reply.status(404).send({ error: 'NOT_FOUND', message: 'Session nicht gefunden' });
    }

    try {
      // Get assistant config
      const assistant = await aiService.getAssistantById(session.assistantId);
      const { type, apiKey } = await aiService.getProviderApiKey(assistant.providerId);

      // Build message history
      const chatMessages: ChatMessage[] = [];
      if (assistant.systemPrompt) {
        chatMessages.push({ role: 'system', content: assistant.systemPrompt });
      }
      for (const msg of sessionMessages) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          chatMessages.push({ role: msg.role as 'user' | 'assistant', content: msg.content });
        }
      }

      // Call LLM
      const adapter = createAdapter(type, apiKey);
      const response = await adapter.chat(chatMessages, {
        model: assistant.model,
        temperature: parseFloat(String(assistant.temperature || '0.7')),
        maxTokens: assistant.maxTokens || 2048,
      });

      const assistantMsg = await aiService.addMessage(sessionId, 'assistant', response);
      return reply.send({ data: assistantMsg, statusCode: 200 });

    } catch (err: any) {
      // If LLM fails, still save an error message
      const errorMsg = await aiService.addMessage(
        sessionId, 'assistant',
        `Fehler bei der KI-Antwort: ${err.message || 'Unbekannter Fehler'}. Bitte überprüfen Sie die Provider-Konfiguration.`
      );
      return reply.send({ data: errorMsg, statusCode: 200 });
    }
  });

  fastify.delete('/api/ai/chat/sessions/:id', { preHandler: [modGuard] }, async (req, reply) => {
    await aiService.deleteSession((req.params as any).id, req.user.sub);
    return reply.send({ data: { message: 'Chat gelöscht' }, statusCode: 200 });
  });
}
