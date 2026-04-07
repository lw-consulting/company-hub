import type { FastifyInstance } from 'fastify';
import * as calService from './calendar.service.js';

export async function calendarRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);
  const modGuard = fastify.requireModule('calendar');

  // GET /api/calendar/events?start=ISO&end=ISO
  fastify.get('/api/calendar/events', { preHandler: [modGuard] }, async (request, reply) => {
    const { start, end } = request.query as { start: string; end: string };
    if (!start || !end) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'start und end Parameter erforderlich' });
    }
    const events = await calService.getEvents(request.user.sub, request.user.orgId, start, end);
    return reply.send({ data: events, statusCode: 200 });
  });

  // GET /api/calendar/events/:id
  fastify.get('/api/calendar/events/:id', { preHandler: [modGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const event = await calService.getEventById(id);
    return reply.send({ data: event, statusCode: 200 });
  });

  // POST /api/calendar/events
  fastify.post('/api/calendar/events', { preHandler: [modGuard] }, async (request, reply) => {
    const data = request.body as any;
    const event = await calService.createEvent(request.user.sub, request.user.orgId, data);
    return reply.status(201).send({ data: event, statusCode: 201 });
  });

  // PATCH /api/calendar/events/:id
  fastify.patch('/api/calendar/events/:id', { preHandler: [modGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    const event = await calService.updateEvent(id, request.user.sub, data);
    return reply.send({ data: event, statusCode: 200 });
  });

  // DELETE /api/calendar/events/:id
  fastify.delete('/api/calendar/events/:id', { preHandler: [modGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await calService.deleteEvent(id, request.user.sub);
    return reply.send({ data: { message: 'Termin gelöscht' }, statusCode: 200 });
  });

  // GET /api/calendar/team-absences?start=ISO&end=ISO
  fastify.get('/api/calendar/team-absences', { preHandler: [modGuard] }, async (request, reply) => {
    const { start, end } = request.query as { start: string; end: string };
    if (!start || !end) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'start und end Parameter erforderlich' });
    }
    const absences = await calService.getTeamAbsences(request.user.orgId, start, end);
    return reply.send({ data: absences, statusCode: 200 });
  });
}
