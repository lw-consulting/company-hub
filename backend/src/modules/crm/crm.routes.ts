import type { FastifyInstance } from 'fastify';
import * as crmService from './crm.service.js';

export async function crmRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  // Contacts
  fastify.get('/api/crm/contacts', async (req, reply) => {
    const data = await crmService.listContacts(req.user.orgId, req.query as any);
    return reply.send({ data, statusCode: 200 });
  });
  fastify.post('/api/crm/contacts', async (req, reply) => {
    const contact = await crmService.createContact(req.user.orgId, req.user.sub, req.body);
    return reply.status(201).send({ data: contact, statusCode: 201 });
  });
  fastify.patch('/api/crm/contacts/:id', async (req, reply) => {
    const contact = await crmService.updateContact((req.params as any).id, req.body);
    return reply.send({ data: contact, statusCode: 200 });
  });
  fastify.delete('/api/crm/contacts/:id', async (req, reply) => {
    await crmService.deleteContact((req.params as any).id);
    return reply.send({ data: { message: 'Gelöscht' }, statusCode: 200 });
  });

  // Companies
  fastify.get('/api/crm/companies', async (req, reply) => {
    const data = await crmService.listCompanies(req.user.orgId);
    return reply.send({ data, statusCode: 200 });
  });
  fastify.post('/api/crm/companies', async (req, reply) => {
    const company = await crmService.createCompany(req.user.orgId, req.user.sub, req.body);
    return reply.status(201).send({ data: company, statusCode: 201 });
  });
  fastify.patch('/api/crm/companies/:id', async (req, reply) => {
    const company = await crmService.updateCompany((req.params as any).id, req.body);
    return reply.send({ data: company, statusCode: 200 });
  });
  fastify.delete('/api/crm/companies/:id', async (req, reply) => {
    await crmService.deleteCompany((req.params as any).id);
    return reply.send({ data: { message: 'Gelöscht' }, statusCode: 200 });
  });

  // Deals
  fastify.get('/api/crm/deals', async (req, reply) => {
    const data = await crmService.listDeals(req.user.orgId, req.query as any);
    return reply.send({ data, statusCode: 200 });
  });
  fastify.get('/api/crm/pipeline', async (req, reply) => {
    const summary = await crmService.getPipelineSummary(req.user.orgId);
    return reply.send({ data: summary, statusCode: 200 });
  });
  fastify.post('/api/crm/deals', async (req, reply) => {
    const deal = await crmService.createDeal(req.user.orgId, req.user.sub, req.body);
    return reply.status(201).send({ data: deal, statusCode: 201 });
  });
  fastify.patch('/api/crm/deals/:id', async (req, reply) => {
    const deal = await crmService.updateDeal((req.params as any).id, req.body);
    return reply.send({ data: deal, statusCode: 200 });
  });
  fastify.delete('/api/crm/deals/:id', async (req, reply) => {
    await crmService.deleteDeal((req.params as any).id);
    return reply.send({ data: { message: 'Gelöscht' }, statusCode: 200 });
  });

  // Activities
  fastify.get('/api/crm/activities', async (req, reply) => {
    const data = await crmService.listActivities(req.user.orgId, req.query as any);
    return reply.send({ data, statusCode: 200 });
  });
  fastify.post('/api/crm/activities', async (req, reply) => {
    const activity = await crmService.createActivity(req.user.orgId, req.user.sub, req.body);
    return reply.status(201).send({ data: activity, statusCode: 201 });
  });

  // Pipeline stages info
  fastify.get('/api/crm/stages', async (req, reply) => {
    return reply.send({ data: crmService.PIPELINE_STAGES, statusCode: 200 });
  });
}
