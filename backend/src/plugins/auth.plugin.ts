import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccessToken } from '../lib/jwt.js';
import { ROLE_HIERARCHY, type Role, type ModuleId, type JwtPayload } from '@company-hub/shared';
import { UnauthorizedError, ForbiddenError } from '../lib/errors.js';

declare module 'fastify' {
  interface FastifyRequest {
    user: JwtPayload;
  }
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireRole: (minRole: Role) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireModule: (moduleId: ModuleId) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export const authPlugin = fp(async function (fastify: FastifyInstance) {
  // Authenticate: verify JWT and attach user to request
  fastify.decorate('authenticate', async function (request: FastifyRequest) {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Token fehlt', 'TOKEN_INVALID');
    }

    try {
      const token = authHeader.slice(7);
      request.user = await verifyAccessToken(token);
    } catch {
      throw new UnauthorizedError('Token ungültig oder abgelaufen', 'TOKEN_EXPIRED');
    }
  });

  // RequireRole: check if user role meets minimum required level
  fastify.decorate('requireRole', function (minRole: Role) {
    return async function (request: FastifyRequest) {
      const userLevel = ROLE_HIERARCHY[request.user.role as Role] ?? 0;
      const requiredLevel = ROLE_HIERARCHY[minRole] ?? 0;

      if (userLevel < requiredLevel) {
        throw new ForbiddenError('Unzureichende Berechtigung', 'INSUFFICIENT_ROLE');
      }
    };
  });

  // RequireModule: check if user has access to a specific module
  fastify.decorate('requireModule', function (moduleId: ModuleId) {
    return async function (request: FastifyRequest) {
      const userRole = request.user.role as Role;
      if (ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY.admin) {
        return;
      }

      if (!request.user.modules?.includes(moduleId)) {
        throw new ForbiddenError('Modul nicht freigeschaltet', 'MODULE_NOT_ENABLED');
      }
    };
  });
});
