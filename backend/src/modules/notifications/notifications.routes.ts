import type { FastifyInstance } from 'fastify';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../config/database.js';
import { notifications } from '../../db/schema/notifications.js';
import {
  getPushDeliveryConfig,
  listNotificationDevices,
  updateNotificationDevice,
  upsertNotificationDevice,
} from '../../lib/notification.service.js';

export async function notificationsRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  const webSubscriptionSchema = z.object({
    endpoint: z.string().min(1),
    expirationTime: z.number().nullable().optional(),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  });

  const expoTokenSchema = z.object({
    token: z.string().min(1),
  });

  const updateDeviceSchema = z.object({
    enabled: z.boolean(),
  });

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

  fastify.get('/api/notifications/push-config', async (_request, reply) => {
    return reply.send({ data: getPushDeliveryConfig(), statusCode: 200 });
  });

  fastify.get('/api/notifications/push-devices', async (request, reply) => {
    const devices = await listNotificationDevices(request.user.sub);
    return reply.send({ data: devices, statusCode: 200 });
  });

  fastify.post('/api/notifications/push/web-subscription', async (request, reply) => {
    const parsed = webSubscriptionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Ungültige Web-Push-Subscription',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const device = await upsertNotificationDevice({
      userId: request.user.sub,
      orgId: request.user.orgId,
      platform: 'web',
      endpoint: parsed.data.endpoint,
      subscription: parsed.data,
      userAgent: request.headers['user-agent'],
    });

    return reply.send({ data: device, statusCode: 200 });
  });

  fastify.post('/api/notifications/push/expo-token', async (request, reply) => {
    const parsed = expoTokenSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Ungültiges Expo Push Token',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const device = await upsertNotificationDevice({
      userId: request.user.sub,
      orgId: request.user.orgId,
      platform: 'expo',
      endpoint: parsed.data.token,
      subscription: { token: parsed.data.token },
      userAgent: request.headers['user-agent'],
    });

    return reply.send({ data: device, statusCode: 200 });
  });

  fastify.patch('/api/notifications/push-devices/:id', async (request, reply) => {
    const parsed = updateDeviceSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: 'Ungültige Geräteänderung',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { id } = request.params as { id: string };
    const device = await updateNotificationDevice(request.user.sub, id, parsed.data);
    return reply.send({ data: device, statusCode: 200 });
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
