import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { env } from './config/env.js';
import { authPlugin } from './plugins/auth.plugin.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { usersRoutes } from './modules/users/users.routes.js';
import { organizationsRoutes } from './modules/organizations/organizations.routes.js';
import { notificationsRoutes } from './modules/notifications/notifications.routes.js';
import { timeTrackingRoutes } from './modules/time-tracking/time-tracking.routes.js';
import { leaveRoutes } from './modules/leave/leave.routes.js';
import { calendarRoutes } from './modules/calendar/calendar.routes.js';
import { communityRoutes } from './modules/community/community.routes.js';
import { tasksRoutes } from './modules/tasks/tasks.routes.js';
import { AppError } from './lib/errors.js';

const fastify = Fastify({
  logger: {
    transport:
      env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
        : undefined,
  },
});

// Security plugins
await fastify.register(helmet, {
  contentSecurityPolicy: env.NODE_ENV === 'production' ? undefined : false,
});

await fastify.register(cors, {
  origin: env.CORS_ORIGINS.split(',').map((o) => o.trim()),
  credentials: true,
});

await fastify.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
});

// Auth plugin (decorates fastify with authenticate, requireRole, requireModule)
await fastify.register(authPlugin);

// Error handler
fastify.setErrorHandler((error: any, request, reply) => {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: error.code,
      message: error.message,
      details: error.details,
    });
  }

  // Rate limit error
  if (error.statusCode === 429) {
    return reply.status(429).send({
      error: 'RATE_LIMIT',
      message: 'Zu viele Anfragen. Bitte später erneut versuchen.',
    });
  }

  fastify.log.error(error);
  return reply.status(500).send({
    error: 'INTERNAL_ERROR',
    message: env.NODE_ENV === 'development' ? error.message : 'Interner Serverfehler',
  });
});

// Health check
fastify.get('/api/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

// Register routes
await fastify.register(authRoutes);
await fastify.register(usersRoutes);
await fastify.register(organizationsRoutes);
await fastify.register(notificationsRoutes);
await fastify.register(timeTrackingRoutes);
await fastify.register(leaveRoutes);
await fastify.register(calendarRoutes);
await fastify.register(communityRoutes);
await fastify.register(tasksRoutes);

// Start server
try {
  await fastify.listen({ port: env.PORT, host: '0.0.0.0' });
  fastify.log.info(`Server running on port ${env.PORT}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
