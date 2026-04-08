import type { FastifyInstance } from 'fastify';
import * as timeService from './time-tracking.service.js';

export async function timeTrackingRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);
  const modGuard = fastify.requireModule('time-tracking');

  // POST /api/time-tracking/clock-in
  fastify.post('/api/time-tracking/clock-in', {
    preHandler: [modGuard],
  }, async (request, reply) => {
    const { notes } = (request.body as any) || {};
    const entry = await timeService.clockIn(request.user.sub, request.user.orgId, notes);
    return reply.status(201).send({ data: entry, statusCode: 201 });
  });

  // POST /api/time-tracking/clock-out
  fastify.post('/api/time-tracking/clock-out', {
    preHandler: [modGuard],
  }, async (request, reply) => {
    const { notes } = (request.body as any) || {};
    const entry = await timeService.clockOut(request.user.sub, request.user.orgId, notes);
    return reply.send({ data: entry, statusCode: 200 });
  });

  // GET /api/time-tracking/active
  fastify.get('/api/time-tracking/active', {
    preHandler: [modGuard],
  }, async (request, reply) => {
    const entry = await timeService.getActiveEntry(request.user.sub);
    return reply.send({ data: entry, statusCode: 200 });
  });

  // GET /api/time-tracking/entries?start=YYYY-MM-DD&end=YYYY-MM-DD
  fastify.get('/api/time-tracking/entries', {
    preHandler: [modGuard],
  }, async (request, reply) => {
    const { start, end } = request.query as { start: string; end: string };
    if (!start || !end) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'start und end Parameter erforderlich' });
    }
    const entries = await timeService.getEntries(request.user.sub, start, end);
    return reply.send({ data: entries, statusCode: 200 });
  });

  // GET /api/time-tracking/summary?start=YYYY-MM-DD&end=YYYY-MM-DD
  fastify.get('/api/time-tracking/summary', {
    preHandler: [modGuard],
  }, async (request, reply) => {
    const { start, end, userId } = request.query as { start: string; end: string; userId?: string };
    if (!start || !end) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'start und end Parameter erforderlich' });
    }
    // Admins/managers can view other users' summaries
    const targetUserId = userId || request.user.sub;
    const summary = await timeService.getSummary(targetUserId, start, end);
    return reply.send({ data: summary, statusCode: 200 });
  });

  // POST /api/time-tracking/break — add a break to active entry
  fastify.post('/api/time-tracking/break', {
    preHandler: [modGuard],
  }, async (request, reply) => {
    const { minutes } = (request.body as any) || {};
    const entry = await timeService.addBreak(request.user.sub, Number(minutes));
    return reply.send({ data: entry, statusCode: 200 });
  });

  // POST /api/time-tracking/breaks/start
  fastify.post('/api/time-tracking/breaks/start', {
    preHandler: [modGuard],
  }, async (request, reply) => {
    const entry = await timeService.startBreak(request.user.sub);
    return reply.send({ data: entry, statusCode: 200 });
  });

  // POST /api/time-tracking/breaks/end
  fastify.post('/api/time-tracking/breaks/end', {
    preHandler: [modGuard],
  }, async (request, reply) => {
    const entry = await timeService.endBreak(request.user.sub);
    return reply.send({ data: entry, statusCode: 200 });
  });

  // PATCH /api/time-tracking/entries/:id/own — user edits their own entry
  fastify.patch('/api/time-tracking/entries/:id/own', {
    preHandler: [modGuard],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    const entry = await timeService.updateOwnEntry(id, request.user.sub, data);
    return reply.send({ data: entry, statusCode: 200 });
  });

  // PATCH /api/time-tracking/entries/:id (supervisor correction)
  fastify.patch('/api/time-tracking/entries/:id', {
    preHandler: [modGuard, fastify.requireRole('manager')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    const entry = await timeService.updateEntry(id, data, request.user.sub);
    return reply.send({ data: entry, statusCode: 200 });
  });

  // GET /api/time-tracking/team?date=YYYY-MM-DD (manager view)
  fastify.get('/api/time-tracking/team', {
    preHandler: [modGuard, fastify.requireRole('manager')],
  }, async (request, reply) => {
    const { date } = request.query as { date: string };
    const today = date || new Date().toISOString().split('T')[0];
    const team = await timeService.getTeamEntries(request.user.sub, request.user.orgId, today);
    return reply.send({ data: team, statusCode: 200 });
  });
}
