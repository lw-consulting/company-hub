import type { FastifyInstance } from 'fastify';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../../config/database.js';
import { notifications } from '../../db/schema/notifications.js';

export async function notificationsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  // GET /api/notifications
  fastify.get('/api/notifications', async (request, reply) => {
    const { page = 1, pageSize = 20 } = request.query as any;
    const offset = (Number(page) - 1) * Number(pageSize);

    const items = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, request.user.sub))
      .orderBy(desc(notifications.createdAt))
      .limit(Number(pageSize))
      .offset(offset);

    return reply.send({ data: items, statusCode: 200 });
  });

  // GET /api/notifications/unread-count
  fastify.get('/api/notifications/unread-count', async (request, reply) => {
    const { sql } = await import('drizzle-orm');
    const [result] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, request.user.sub),
          eq(notifications.isRead, false)
        )
      );

    return reply.send({ data: { count: result?.count || 0 }, statusCode: 200 });
  });

  // PATCH /api/notifications/:id/read
  fastify.patch('/api/notifications/:id/read', async (request, reply) => {
    const { id } = request.params as { id: string };

    await db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.userId, request.user.sub)
        )
      );

    return reply.send({ data: { message: 'Gelesen' }, statusCode: 200 });
  });

  // POST /api/notifications/mark-all-read
  fastify.post('/api/notifications/mark-all-read', async (request, reply) => {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(notifications.userId, request.user.sub),
          eq(notifications.isRead, false)
        )
      );

    return reply.send({ data: { message: 'Alle als gelesen markiert' }, statusCode: 200 });
  });
}
