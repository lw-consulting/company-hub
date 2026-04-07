import type { FastifyInstance } from 'fastify';
import * as tasksService from './tasks.service.js';

export async function tasksRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);
  const modGuard = fastify.requireModule('tasks');

  // GET /api/tasks
  fastify.get('/api/tasks', { preHandler: [modGuard] }, async (request, reply) => {
    const { status, assignedTo, page, pageSize } = request.query as any;
    const result = await tasksService.listTasks(request.user.orgId, request.user.sub, {
      status,
      assignedTo,
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 50,
    });
    return reply.send({ data: result, statusCode: 200 });
  });

  // POST /api/tasks
  fastify.post('/api/tasks', { preHandler: [modGuard] }, async (request, reply) => {
    const data = request.body as any;
    const task = await tasksService.createTask(request.user.sub, request.user.orgId, data);
    return reply.status(201).send({ data: task, statusCode: 201 });
  });

  // GET /api/tasks/:id
  fastify.get('/api/tasks/:id', { preHandler: [modGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const task = await tasksService.getTaskById(id);
    return reply.send({ data: task, statusCode: 200 });
  });

  // PATCH /api/tasks/:id
  fastify.patch('/api/tasks/:id', { preHandler: [modGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    const task = await tasksService.updateTask(id, data);
    return reply.send({ data: task, statusCode: 200 });
  });

  // DELETE /api/tasks/:id
  fastify.delete('/api/tasks/:id', { preHandler: [modGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await tasksService.deleteTask(id);
    return reply.send({ data: { message: 'Aufgabe gelöscht' }, statusCode: 200 });
  });

  // POST /api/tasks/:id/comments
  fastify.post('/api/tasks/:id/comments', { preHandler: [modGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { content } = request.body as { content: string };
    const comment = await tasksService.addComment(id, request.user.sub, content);
    return reply.status(201).send({ data: comment, statusCode: 201 });
  });
}
