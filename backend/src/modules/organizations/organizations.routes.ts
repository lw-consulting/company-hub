import type { FastifyInstance } from 'fastify';
import { updateOrganizationSchema } from '@company-hub/shared';
import * as orgService from './organizations.service.js';
import { ValidationError } from '../../lib/errors.js';

export async function organizationsRoutes(fastify: FastifyInstance) {
  // GET /api/organizations/current (requires auth)
  fastify.get('/api/organizations/current', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const org = await orgService.getOrganization(request.user.orgId);
    return reply.send({ data: org, statusCode: 200 });
  });

  // PATCH /api/organizations/current (admin only)
  fastify.patch('/api/organizations/current', {
    preHandler: [fastify.authenticate, fastify.requireRole('admin')],
  }, async (request, reply) => {
    const parsed = updateOrganizationSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.flatten().fieldErrors as Record<string, string[]>);
    }

    const org = await orgService.updateOrganization(request.user.orgId, parsed.data);
    return reply.send({ data: org, statusCode: 200 });
  });

  // GET /api/organizations/branding (public - for theming before login)
  fastify.get('/api/organizations/branding', async (request, reply) => {
    // For now, return first org. In multi-tenant, resolve by domain/slug.
    const { db } = await import('../../config/database.js');
    const { organizations } = await import('../../db/schema/organizations.js');
    const [org] = await db.select().from(organizations).limit(1);
    if (!org) {
      return reply.send({
        data: {
          name: 'Company Hub',
          logoUrl: null,
          primaryColor: '#6366f1',
          secondaryColor: '#1e1b4b',
          accentColor: '#f59e0b',
          locale: 'de',
        },
        statusCode: 200,
      });
    }
    const branding = await orgService.getOrganizationBranding(org.id);
    return reply.send({ data: branding, statusCode: 200 });
  });
}
