import type { FastifyInstance } from 'fastify';
import { createUserSchema, updateUserSchema, updateModulePermissionsSchema } from '@company-hub/shared';
import * as usersService from './users.service.js';
import { ValidationError } from '../../lib/errors.js';

export async function usersRoutes(fastify: FastifyInstance) {
  // All user routes require authentication and admin role
  fastify.addHook('preHandler', fastify.authenticate);

  // GET /api/users
  fastify.get('/api/users', {
    preHandler: [fastify.requireRole('admin')],
  }, async (request, reply) => {
    const { page, pageSize, search } = request.query as any;
    const result = await usersService.listUsers(request.user.orgId, {
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 25,
      search,
    });
    return reply.send({ data: result, statusCode: 200 });
  });

  // GET /api/users/:id
  fastify.get('/api/users/:id', {
    preHandler: [fastify.requireRole('admin')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = await usersService.getUserById(id);
    return reply.send({ data: user, statusCode: 200 });
  });

  // POST /api/users
  fastify.post('/api/users', {
    preHandler: [fastify.requireRole('admin')],
  }, async (request, reply) => {
    const parsed = createUserSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);
    }

    const user = await usersService.createUser(parsed.data, request.user.orgId);
    return reply.status(201).send({ data: user, statusCode: 201 });
  });

  // PATCH /api/users/:id
  fastify.patch('/api/users/:id', {
    preHandler: [fastify.requireRole('admin')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateUserSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);
    }

    const user = await usersService.updateUser(id, parsed.data);
    return reply.send({ data: user, statusCode: 200 });
  });

  // DELETE /api/users/:id
  fastify.delete('/api/users/:id', {
    preHandler: [fastify.requireRole('super_admin')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await usersService.deleteUser(id);
    return reply.send({ data: { message: 'Benutzer gelöscht' }, statusCode: 200 });
  });

  // GET /api/users/:id/modules
  fastify.get('/api/users/:id/modules', {
    preHandler: [fastify.requireRole('admin')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const modules = await usersService.getUserModulePermissions(id);
    return reply.send({ data: modules, statusCode: 200 });
  });

  // PUT /api/users/:id/modules
  fastify.put('/api/users/:id/modules', {
    preHandler: [fastify.requireRole('admin')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const parsed = updateModulePermissionsSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);
    }

    const modules = await usersService.updateUserModulePermissions(
      id,
      parsed.data.modules,
      request.user.sub
    );
    return reply.send({ data: modules, statusCode: 200 });
  });

  // GET /api/users/supervisors (list potential supervisors for dropdown)
  fastify.get('/api/users/supervisors', {
    preHandler: [fastify.requireRole('admin')],
  }, async (request, reply) => {
    const result = await usersService.listUsers(request.user.orgId, { pageSize: 200 });
    const supervisors = result.data
      .filter((u) => u.isActive)
      .map((u) => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
      }));
    return reply.send({ data: supervisors, statusCode: 200 });
  });
}
