import type { FastifyInstance } from 'fastify';
import { loginSchema, refreshSchema, changePasswordSchema } from '@company-hub/shared';
import * as authService from './auth.service.js';
import { ValidationError } from '../../lib/errors.js';

export async function authRoutes(fastify: FastifyInstance) {
  // POST /api/auth/login
  fastify.post('/api/auth/login', {
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);
    }

    const tokens = await authService.login(parsed.data.email, parsed.data.password);
    return reply.send({ data: tokens, statusCode: 200 });
  });

  // POST /api/auth/refresh
  fastify.post('/api/auth/refresh', {
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const parsed = refreshSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);
    }

    const tokens = await authService.refresh(parsed.data.refreshToken);
    return reply.send({ data: tokens, statusCode: 200 });
  });

  // POST /api/auth/logout
  fastify.post('/api/auth/logout', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    await authService.logout(request.user.sub);
    return reply.send({ data: { message: 'Abgemeldet' }, statusCode: 200 });
  });

  // GET /api/auth/me
  fastify.get('/api/auth/me', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const user = await authService.getMe(request.user.sub);
    return reply.send({ data: user, statusCode: 200 });
  });

  // POST /api/auth/change-password
  fastify.post('/api/auth/change-password', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const parsed = changePasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);
    }

    await authService.changePassword(
      request.user.sub,
      parsed.data.currentPassword,
      parsed.data.newPassword
    );
    return reply.send({ data: { message: 'Passwort geändert' }, statusCode: 200 });
  });
}
