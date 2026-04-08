import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as aiService from './ai-assistants.service.js';
import * as chatService from './chat.service.js';
import * as knowledgeService from './knowledge.service.js';
import { setupSse } from '../../lib/sse.js';

const assistantSchema = z.object({
  providerId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  model: z.string().min(1).max(100),
  systemPrompt: z.string().max(50_000).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(8_192).optional(),
  topP: z.number().min(0).max(1).optional(),
  tone: z.string().max(50).optional(),
  language: z.string().max(10).optional(),
  openingMessage: z.string().max(5_000).optional(),
  responseStructure: z.string().max(5_000).optional(),
  avatarUrl: z.string().url().optional().or(z.literal('')),
  forbiddenTopics: z.array(z.string().max(200)).optional(),
  isActive: z.boolean().optional(),
});

const streamMessageSchema = z.object({
  message: z.string().min(1).max(10_000),
  sessionId: z.string().uuid().optional(),
  fileContext: z.string().max(15_000).optional(),
});

const replaceAssignmentsSchema = z.object({
  assistantIds: z.array(z.string().uuid()),
});

const uploadTextSchema = z.object({
  filename: z.string().min(1).max(500),
  fileType: z.string().min(1).max(30),
  mimeType: z.string().max(150).optional().nullable(),
  fileSize: z.number().int().min(1),
  textContent: z.string().min(1).max(200_000),
});

export async function aiAssistantsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);
  const modGuard = fastify.requireModule('ai-assistants');

  fastify.get('/api/ai/providers', { preHandler: [modGuard, fastify.requireRole('admin')] }, async (req, reply) => {
    const providers = await aiService.listProviders(req.user.orgId);
    return reply.send({ data: providers, statusCode: 200 });
  });

  fastify.post('/api/ai/providers', { preHandler: [modGuard, fastify.requireRole('admin')] }, async (req, reply) => {
    const body = z.object({
      name: z.string().min(1).max(100),
      type: z.string().min(1).max(30),
      apiKey: z.string().min(1),
    }).parse(req.body);

    const provider = await aiService.createProvider(req.user.orgId, body);
    return reply.status(201).send({ data: provider, statusCode: 201 });
  });

  fastify.delete('/api/ai/providers/:id', { preHandler: [modGuard, fastify.requireRole('admin')] }, async (req, reply) => {
    await aiService.deleteProvider(req.user.orgId, (req.params as { id: string }).id);
    return reply.send({ data: { message: 'Provider geloescht' }, statusCode: 200 });
  });

  fastify.get('/api/ai/assistants', { preHandler: [modGuard, fastify.requireRole('admin')] }, async (req, reply) => {
    const assistants = await aiService.listAssistants(req.user.orgId);
    return reply.send({ data: assistants, statusCode: 200 });
  });

  fastify.get('/api/ai/assistants/:id', { preHandler: [modGuard] }, async (req, reply) => {
    const assistant = await aiService.getAssistantById((req.params as { id: string }).id, req.user.orgId);
    return reply.send({ data: assistant, statusCode: 200 });
  });

  fastify.post('/api/ai/assistants', { preHandler: [modGuard, fastify.requireRole('admin')] }, async (req, reply) => {
    const assistant = await aiService.createAssistant(req.user.orgId, assistantSchema.parse(req.body));
    return reply.status(201).send({ data: assistant, statusCode: 201 });
  });

  fastify.patch('/api/ai/assistants/:id', { preHandler: [modGuard, fastify.requireRole('admin')] }, async (req, reply) => {
    const assistant = await aiService.updateAssistant(
      (req.params as { id: string }).id,
      req.user.orgId,
      assistantSchema.partial().parse(req.body),
    );
    return reply.send({ data: assistant, statusCode: 200 });
  });

  fastify.delete('/api/ai/assistants/:id', { preHandler: [modGuard, fastify.requireRole('admin')] }, async (req, reply) => {
    await aiService.deleteAssistant((req.params as { id: string }).id, req.user.orgId);
    return reply.send({ data: { message: 'Assistent geloescht' }, statusCode: 200 });
  });

  fastify.post('/api/ai/assistants/:id/assign', { preHandler: [modGuard, fastify.requireRole('admin')] }, async (req, reply) => {
    const body = z.object({ userId: z.string().uuid() }).parse(req.body);
    await aiService.assignAssistant(req.user.orgId, (req.params as { id: string }).id, body.userId);
    return reply.send({ data: { message: 'Zugewiesen' }, statusCode: 200 });
  });

  fastify.post('/api/ai/assistants/:id/unassign', { preHandler: [modGuard, fastify.requireRole('admin')] }, async (req, reply) => {
    const body = z.object({ userId: z.string().uuid() }).parse(req.body);
    await aiService.unassignAssistant(req.user.orgId, (req.params as { id: string }).id, body.userId);
    return reply.send({ data: { message: 'Zuweisung entfernt' }, statusCode: 200 });
  });

  fastify.get('/api/ai/users/:userId/assistants', { preHandler: [modGuard, fastify.requireRole('admin')] }, async (req, reply) => {
    const assistants = await aiService.getAssignedAssistantsForUser(req.user.orgId, (req.params as { userId: string }).userId);
    return reply.send({ data: assistants, statusCode: 200 });
  });

  fastify.put('/api/ai/users/:userId/assistants', { preHandler: [modGuard, fastify.requireRole('admin')] }, async (req, reply) => {
    const body = replaceAssignmentsSchema.parse(req.body);
    await aiService.replaceAssignments(req.user.orgId, (req.params as { userId: string }).userId, body.assistantIds);
    return reply.send({ data: { success: true }, statusCode: 200 });
  });

  fastify.get('/api/ai/my-assistants', { preHandler: [modGuard] }, async (req, reply) => {
    const assistants = await aiService.getMyAssistants(req.user.sub, req.user.orgId);
    return reply.send({ data: assistants, statusCode: 200 });
  });

  fastify.post('/api/ai/chat/sessions', { preHandler: [modGuard] }, async (req, reply) => {
    const body = z.object({ assistantId: z.string().uuid() }).parse(req.body);
    const session = await aiService.createSession(req.user.orgId, body.assistantId, req.user.sub);
    return reply.status(201).send({ data: session, statusCode: 201 });
  });

  fastify.get('/api/ai/chat/sessions', { preHandler: [modGuard] }, async (req, reply) => {
    const query = z.object({ assistantId: z.string().uuid().optional() }).parse(req.query);
    const sessions = await aiService.getMySessions(req.user.sub, query.assistantId);
    return reply.send({ data: sessions, statusCode: 200 });
  });

  fastify.get('/api/ai/chat/sessions/:id/messages', { preHandler: [modGuard] }, async (req, reply) => {
    const sessionId = (req.params as { id: string }).id;
    const messages = await aiService.getSessionMessages(sessionId, req.user.sub);
    return reply.send({ data: messages, statusCode: 200 });
  });

  fastify.post('/api/ai/chat/:assistantId/stream', { preHandler: [modGuard] }, async (req, reply) => {
    const body = streamMessageSchema.parse(req.body);
    const assistantId = (req.params as { assistantId: string }).assistantId;

    setupSse(reply);

    try {
      for await (const event of chatService.streamAssistantReply({
        orgId: req.user.orgId,
        assistantId,
        userId: req.user.sub,
        message: body.message,
        sessionId: body.sessionId,
        fileContext: body.fileContext,
      })) {
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
      }
    } finally {
      if (!reply.raw.destroyed && !reply.raw.writableEnded) {
        reply.raw.end();
      }
    }
  });

  fastify.delete('/api/ai/chat/sessions/:id', { preHandler: [modGuard] }, async (req, reply) => {
    await aiService.deleteSession((req.params as { id: string }).id, req.user.sub);
    return reply.send({ data: { message: 'Chat geloescht' }, statusCode: 200 });
  });

  fastify.get('/api/ai/assistants/:assistantId/knowledge', { preHandler: [modGuard, fastify.requireRole('admin')] }, async (req, reply) => {
    const documents = await knowledgeService.listDocuments((req.params as { assistantId: string }).assistantId, req.user.orgId);
    return reply.send({ data: documents, statusCode: 200 });
  });

  fastify.post('/api/ai/assistants/:assistantId/knowledge/upload-text', { preHandler: [modGuard, fastify.requireRole('admin')] }, async (req, reply) => {
    const body = uploadTextSchema.parse(req.body);
    const document = await knowledgeService.createDocumentFromText({
      assistantId: (req.params as { assistantId: string }).assistantId,
      orgId: req.user.orgId,
      filename: body.filename,
      fileType: body.fileType,
      mimeType: body.mimeType,
      fileSize: body.fileSize,
      textContent: body.textContent,
      uploadedBy: req.user.sub,
    });
    return reply.status(201).send({ data: document, statusCode: 201 });
  });

  fastify.post('/api/ai/assistants/:assistantId/chat-upload', { preHandler: [modGuard] }, async (req, reply) => {
    const assistantId = (req.params as { assistantId: string }).assistantId;
    await aiService.ensureAssignedAssistant(req.user.orgId, assistantId, req.user.sub);

    const file = await req.file();
    if (!file) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'Keine Datei hochgeladen' });
    }

    const fileType = file.filename.split('.').pop()?.toLowerCase() ?? '';
    const buffer = await file.toBuffer();

    try {
      const textContent = knowledgeService.extractTextFromBuffer(buffer, fileType);
      const truncated = textContent.length > 15_000
        ? `${textContent.slice(0, 15_000)}\n\n[... Datei gekuerzt ...]`
        : textContent;

      return reply.send({
        data: {
          filename: file.filename,
          fileType,
          textContent: truncated,
          charCount: textContent.length,
          truncated: textContent.length > 15_000,
        },
        statusCode: 200,
      });
    } catch (error) {
      return reply.status(422).send({
        error: 'VALIDATION_ERROR',
        message: error instanceof Error ? error.message : 'Datei konnte nicht gelesen werden',
      });
    }
  });

  fastify.patch('/api/ai/knowledge/:documentId/include', { preHandler: [modGuard, fastify.requireRole('admin')] }, async (req, reply) => {
    const body = z.object({ includeInPrompt: z.boolean() }).parse(req.body);
    await knowledgeService.toggleIncludeInPrompt((req.params as { documentId: string }).documentId, req.user.orgId, body.includeInPrompt);
    return reply.send({ data: { success: true }, statusCode: 200 });
  });

  fastify.delete('/api/ai/knowledge/:documentId', { preHandler: [modGuard, fastify.requireRole('admin')] }, async (req, reply) => {
    await knowledgeService.deleteDocument((req.params as { documentId: string }).documentId, req.user.orgId);
    return reply.send({ data: { success: true }, statusCode: 200 });
  });
}
