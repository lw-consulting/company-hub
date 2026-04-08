import type { FastifyInstance } from 'fastify';
import * as leaveService from './leave.service.js';

export async function leaveRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);
  const modGuard = fastify.requireModule('leave');

  // --- Leave Types ---

  // GET /api/leave/types
  fastify.get('/api/leave/types', { preHandler: [modGuard] }, async (request, reply) => {
    const types = await leaveService.getLeaveTypes(request.user.orgId);
    return reply.send({ data: types, statusCode: 200 });
  });

  // POST /api/leave/types (admin/hr)
  fastify.post('/api/leave/types', {
    preHandler: [modGuard, fastify.requireRole('hr')],
  }, async (request, reply) => {
    const data = request.body as any;
    const type = await leaveService.createLeaveType(request.user.orgId, data);
    return reply.status(201).send({ data: type, statusCode: 201 });
  });

  // --- Leave Requests ---

  // POST /api/leave/requests
  fastify.post('/api/leave/requests', { preHandler: [modGuard] }, async (request, reply) => {
    const data = request.body as any;
    const req = await leaveService.createLeaveRequest(request.user.sub, request.user.orgId, data);
    return reply.status(201).send({ data: req, statusCode: 201 });
  });

  // GET /api/leave/requests (my requests)
  fastify.get('/api/leave/requests', { preHandler: [modGuard] }, async (request, reply) => {
    const { year } = request.query as { year?: string };
    const requests = await leaveService.getMyLeaveRequests(request.user.sub, year ? Number(year) : undefined);
    return reply.send({ data: requests, statusCode: 200 });
  });

  // GET /api/leave/balance
  fastify.get('/api/leave/balance', { preHandler: [modGuard] }, async (request, reply) => {
    const { year } = request.query as { year?: string };
    const balance = await leaveService.getVacationBalance(request.user.sub, year ? Number(year) : undefined);
    return reply.send({ data: balance, statusCode: 200 });
  });

  // PATCH /api/leave/requests/:id/own (user edits own pending request)
  fastify.patch('/api/leave/requests/:id/own', { preHandler: [modGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    const updated = await leaveService.updateOwnLeaveRequest(id, request.user.sub, request.user.orgId, data);
    return reply.send({ data: updated, statusCode: 200 });
  });

  // DELETE /api/leave/requests/:id/own (user cancels own pending request)
  fastify.delete('/api/leave/requests/:id/own', { preHandler: [modGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await leaveService.cancelOwnLeaveRequest(id, request.user.sub);
    return reply.send({ data: result, statusCode: 200 });
  });

  // --- Supervisor / Approval ---

  // GET /api/leave/pending (supervisor sees pending requests)
  fastify.get('/api/leave/pending', {
    preHandler: [modGuard, fastify.requireRole('manager')],
  }, async (request, reply) => {
    const pending = await leaveService.getPendingRequestsForSupervisor(request.user.sub, request.user.orgId);
    return reply.send({ data: pending, statusCode: 200 });
  });

  // PATCH /api/leave/requests/:id (approve/reject)
  fastify.patch('/api/leave/requests/:id', {
    preHandler: [modGuard, fastify.requireRole('manager')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { status, note } = request.body as { status: 'approved' | 'rejected'; note?: string };
    const updated = await leaveService.decideLeaveRequest(id, request.user.sub, status, note);
    return reply.send({ data: updated, statusCode: 200 });
  });

  // --- Public Holidays ---

  // GET /api/leave/holidays
  fastify.get('/api/leave/holidays', { preHandler: [modGuard] }, async (request, reply) => {
    const { year } = request.query as { year?: string };
    const holidays = await leaveService.getPublicHolidays(request.user.orgId, year ? Number(year) : undefined);
    return reply.send({ data: holidays, statusCode: 200 });
  });

  // POST /api/leave/holidays (admin/hr)
  fastify.post('/api/leave/holidays', {
    preHandler: [modGuard, fastify.requireRole('hr')],
  }, async (request, reply) => {
    const data = request.body as any;
    const holiday = await leaveService.createPublicHoliday(request.user.orgId, data);
    return reply.status(201).send({ data: holiday, statusCode: 201 });
  });

  // DELETE /api/leave/holidays/:id (admin/hr)
  fastify.delete('/api/leave/holidays/:id', {
    preHandler: [modGuard, fastify.requireRole('hr')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await leaveService.deletePublicHoliday(id);
    return reply.send({ data: { message: 'Feiertag gelöscht' }, statusCode: 200 });
  });
}
