import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
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
import { aiAssistantsRoutes } from './modules/ai-assistants/ai-assistants.routes.js';
import { coursesRoutes } from './modules/courses/courses.routes.js';
import { integrationsRoutes } from './modules/integrations/integrations.routes.js';
import { crmRoutes } from './modules/crm/crm.routes.js';
import { filesRoutes } from './modules/files/files.routes.js';
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

// Multipart (file uploads)
await fastify.register(multipart, { limits: { fileSize: env.MAX_FILE_SIZE } });

// Static files (uploaded assets)
await fastify.register(fastifyStatic, {
  root: env.UPLOAD_DIR,
  prefix: '/uploads/',
  decorateReply: false,
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

// One-time DB repair endpoint — creates missing tables
fastify.get('/api/db-repair', async (request, reply) => {
  const { db: database } = await import('./config/database.js');
  const pgModule = await import('pg');
  const { env: envConfig } = await import('./config/env.js');
  const pool = new pgModule.default.Pool({ connectionString: envConfig.DATABASE_URL });

  const statements = [
    `CREATE TABLE IF NOT EXISTS community_forum_groups (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, name VARCHAR(200) NOT NULL, icon VARCHAR(50), color VARCHAR(7) DEFAULT '#6366f1', sort_order INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS community_forums (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), group_id UUID NOT NULL REFERENCES community_forum_groups(id) ON DELETE CASCADE, org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, name VARCHAR(200) NOT NULL, description TEXT, icon VARCHAR(50), is_announcement BOOLEAN NOT NULL DEFAULT false, sort_order INTEGER NOT NULL DEFAULT 0, post_count INTEGER NOT NULL DEFAULT 0, last_post_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS forum_id UUID REFERENCES community_forums(id) ON DELETE SET NULL`,
    `ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS post_type VARCHAR(20) NOT NULL DEFAULT 'post'`,
    `ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS background VARCHAR(50)`,
    `ALTER TABLE community_posts ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'`,
    `CREATE TABLE IF NOT EXISTS community_reactions (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, post_id UUID REFERENCES community_posts(id) ON DELETE CASCADE, comment_id UUID REFERENCES community_comments(id) ON DELETE CASCADE, reaction_type VARCHAR(20) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS community_polls (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE, question TEXT NOT NULL, multiple_choice BOOLEAN NOT NULL DEFAULT false, ends_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS community_poll_options (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), poll_id UUID NOT NULL REFERENCES community_polls(id) ON DELETE CASCADE, text VARCHAR(300) NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0)`,
    `CREATE TABLE IF NOT EXISTS community_poll_votes (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), option_id UUID NOT NULL REFERENCES community_poll_options(id) ON DELETE CASCADE, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS community_bookmarks (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS community_follows (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS community_profiles (user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, bio TEXT, headline VARCHAR(200), social_links JSONB DEFAULT '{}', updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS crm_contacts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, first_name VARCHAR(100) NOT NULL, last_name VARCHAR(100) NOT NULL, email VARCHAR(255), phone VARCHAR(50), position VARCHAR(100), notes TEXT, tags JSONB DEFAULT '[]', owner_id UUID REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS crm_companies (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, name VARCHAR(300) NOT NULL, website VARCHAR(500), industry VARCHAR(100), size VARCHAR(50), address TEXT, phone VARCHAR(50), notes TEXT, owner_id UUID REFERENCES users(id) ON DELETE SET NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS crm_deals (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, title VARCHAR(300) NOT NULL, value NUMERIC(12,2), currency VARCHAR(3) DEFAULT 'EUR', stage VARCHAR(50) NOT NULL DEFAULT 'lead', probability INTEGER DEFAULT 0, contact_id UUID, company_id UUID, owner_id UUID REFERENCES users(id) ON DELETE SET NULL, expected_close_date TIMESTAMPTZ, closed_at TIMESTAMPTZ, notes TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE TABLE IF NOT EXISTS crm_activities (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE, type VARCHAR(30) NOT NULL, title VARCHAR(300) NOT NULL, description TEXT, contact_id UUID, deal_id UUID, company_id UUID, created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, activity_date TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    // Time tracking user edit tracking
    `ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS user_edited BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS user_edited_at TIMESTAMPTZ`,
    // User time tracking settings
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS initial_balance_minutes INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS working_days JSONB NOT NULL DEFAULT '[1,2,3,4,5]'`,
  ];

  const results: string[] = [];
  for (const stmt of statements) {
    try {
      await pool.query(stmt);
      results.push('OK: ' + stmt.substring(0, 60) + '...');
    } catch (e: any) {
      results.push('ERR: ' + e.message);
    }
  }

  await pool.end();
  return reply.send({ data: results, statusCode: 200 });
});

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
await fastify.register(aiAssistantsRoutes);
await fastify.register(coursesRoutes);
await fastify.register(integrationsRoutes);
await fastify.register(crmRoutes);
await fastify.register(filesRoutes);

// Start server
try {
  await fastify.listen({ port: env.PORT, host: '0.0.0.0' });
  fastify.log.info(`Server running on port ${env.PORT}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
