import type { FastifyInstance } from 'fastify';
import { setupSse } from '../../lib/sse.js';
import * as chatService from './chat.service.js';
import { subscribeToChatEvents } from './chat-realtime.js';

export async function chatRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);
  const modGuard = fastify.requireModule('chat');

  fastify.get('/api/chat/users', { preHandler: [modGuard] }, async (request, reply) => {
    const users = await chatService.listChatUsers(request.user.orgId, request.user.sub);
    return reply.send({ data: users, statusCode: 200 });
  });

  fastify.get('/api/chat/conversations', { preHandler: [modGuard] }, async (request, reply) => {
    const conversations = await chatService.listConversations(request.user.sub, request.user.orgId);
    return reply.send({ data: conversations, statusCode: 200 });
  });

  fastify.post('/api/chat/conversations/direct', { preHandler: [modGuard] }, async (request, reply) => {
    const { userId } = request.body as { userId: string };
    const conversationId = await chatService.getOrCreateDirectConversation(request.user.sub, request.user.orgId, userId);
    return reply.status(201).send({ data: { id: conversationId }, statusCode: 201 });
  });

  fastify.post('/api/chat/conversations/group', { preHandler: [modGuard] }, async (request, reply) => {
    const payload = request.body as { title: string; participantIds: string[] };
    const conversationId = await chatService.createGroupConversation(request.user.sub, request.user.orgId, payload);
    return reply.status(201).send({ data: { id: conversationId }, statusCode: 201 });
  });

  fastify.get('/api/chat/conversations/:id/messages', { preHandler: [modGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { before, limit } = request.query as { before?: string; limit?: string };
    const messages = await chatService.listMessages(id, request.user.sub, request.user.orgId, {
      before,
      limit: limit ? Number(limit) : undefined,
    });
    return reply.send({ data: messages, statusCode: 200 });
  });

  fastify.post('/api/chat/conversations/:id/messages', { preHandler: [modGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const payload = request.body as { content?: string };
    const message = await chatService.sendMessage(id, request.user.sub, request.user.orgId, payload);
    return reply.status(201).send({ data: message, statusCode: 201 });
  });

  fastify.post('/api/chat/conversations/:id/upload', { preHandler: [modGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parts = request.parts();
    let content = '';
    let filePart: Awaited<ReturnType<typeof request.file>> | null = null;

    for await (const part of parts) {
      if (part.type === 'field' && part.fieldname === 'content') {
        content = String(part.value ?? '');
      }
      if (part.type === 'file') {
        filePart = part;
      }
    }

    if (!filePart) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'Keine Datei hochgeladen' });
    }

    const buffer = await filePart.toBuffer();
    const message = await chatService.uploadAttachmentMessage(
      id,
      request.user.sub,
      request.user.orgId,
      {
        filename: filePart.filename,
        mimetype: filePart.mimetype,
        data: buffer,
      },
      content
    );
    return reply.status(201).send({ data: message, statusCode: 201 });
  });

  fastify.post('/api/chat/conversations/:id/read', { preHandler: [modGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await chatService.markConversationRead(id, request.user.sub, request.user.orgId);
    return reply.send({ data: { success: true }, statusCode: 200 });
  });

  fastify.patch('/api/chat/conversations/:id', { preHandler: [modGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { title } = request.body as { title: string };
    await chatService.renameConversation(id, request.user.sub, request.user.orgId, title);
    return reply.send({ data: { success: true }, statusCode: 200 });
  });

  fastify.get('/api/chat/events/stream', { preHandler: [modGuard] }, async (request, reply) => {
    setupSse(reply);
    await chatService.listConversations(request.user.sub, request.user.orgId);

    const sendEvent = (event: Record<string, unknown>) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    const unsubscribe = subscribeToChatEvents(request.user.sub, sendEvent);
    const heartbeat = setInterval(() => {
      reply.raw.write(': heartbeat\n\n');
    }, 15_000);

    request.raw.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
      if (!reply.raw.destroyed) {
        reply.raw.end();
      }
    });
  });
}
