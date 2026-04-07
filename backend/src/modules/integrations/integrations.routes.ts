import type { FastifyInstance } from 'fastify';
import * as intService from './integrations.service.js';

export async function integrationsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  // ============== WEBHOOKS ==============

  fastify.get('/api/integrations/webhooks', {
    preHandler: [fastify.requireRole('admin')],
  }, async (req, reply) => {
    const hooks = await intService.listWebhooks(req.user.orgId);
    return reply.send({ data: hooks, statusCode: 200 });
  });

  fastify.get('/api/integrations/webhook-events', {
    preHandler: [fastify.requireRole('admin')],
  }, async (req, reply) => {
    return reply.send({ data: intService.WEBHOOK_EVENTS, statusCode: 200 });
  });

  fastify.post('/api/integrations/webhooks', {
    preHandler: [fastify.requireRole('admin')],
  }, async (req, reply) => {
    const webhook = await intService.createWebhook(req.user.orgId, req.user.sub, req.body as any);
    return reply.status(201).send({ data: webhook, statusCode: 201 });
  });

  fastify.patch('/api/integrations/webhooks/:id', {
    preHandler: [fastify.requireRole('admin')],
  }, async (req, reply) => {
    const webhook = await intService.updateWebhook((req.params as any).id, req.body as any);
    return reply.send({ data: webhook, statusCode: 200 });
  });

  fastify.delete('/api/integrations/webhooks/:id', {
    preHandler: [fastify.requireRole('admin')],
  }, async (req, reply) => {
    await intService.deleteWebhook((req.params as any).id);
    return reply.send({ data: { message: 'Webhook gelöscht' }, statusCode: 200 });
  });

  fastify.get('/api/integrations/webhooks/:id/deliveries', {
    preHandler: [fastify.requireRole('admin')],
  }, async (req, reply) => {
    const deliveries = await intService.getWebhookDeliveries((req.params as any).id);
    return reply.send({ data: deliveries, statusCode: 200 });
  });

  // ============== API KEYS ==============

  fastify.get('/api/integrations/api-keys', {
    preHandler: [fastify.requireRole('admin')],
  }, async (req, reply) => {
    const keys = await intService.listApiKeys(req.user.orgId);
    return reply.send({ data: keys, statusCode: 200 });
  });

  fastify.get('/api/integrations/api-scopes', {
    preHandler: [fastify.requireRole('admin')],
  }, async (req, reply) => {
    return reply.send({ data: intService.AVAILABLE_SCOPES, statusCode: 200 });
  });

  fastify.post('/api/integrations/api-keys', {
    preHandler: [fastify.requireRole('admin')],
  }, async (req, reply) => {
    const key = await intService.createApiKey(req.user.orgId, req.user.sub, req.body as any);
    return reply.status(201).send({ data: key, statusCode: 201 });
  });

  fastify.post('/api/integrations/api-keys/:id/revoke', {
    preHandler: [fastify.requireRole('admin')],
  }, async (req, reply) => {
    await intService.revokeApiKey((req.params as any).id);
    return reply.send({ data: { message: 'API-Key widerrufen' }, statusCode: 200 });
  });

  fastify.delete('/api/integrations/api-keys/:id', {
    preHandler: [fastify.requireRole('admin')],
  }, async (req, reply) => {
    await intService.deleteApiKey((req.params as any).id);
    return reply.send({ data: { message: 'API-Key gelöscht' }, statusCode: 200 });
  });
}
