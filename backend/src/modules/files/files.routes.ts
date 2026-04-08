import type { FastifyInstance } from 'fastify';
import * as filesService from './files.service.js';

export async function filesRoutes(fastify: FastifyInstance) {
  // POST /api/files/avatar — upload profile picture
  fastify.post('/api/files/avatar', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'Keine Datei hochgeladen' });
    }
    const buffer = await data.toBuffer();
    const result = await filesService.uploadAvatar(
      request.user.sub,
      request.user.orgId,
      { filename: data.filename, mimetype: data.mimetype, data: buffer }
    );
    return reply.send({ data: result, statusCode: 200 });
  });

  // POST /api/files/logo — upload organization logo (admin only)
  fastify.post('/api/files/logo', {
    preHandler: [fastify.authenticate, fastify.requireRole('admin')],
  }, async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'Keine Datei hochgeladen' });
    }
    const buffer = await data.toBuffer();
    const result = await filesService.uploadLogo(
      request.user.orgId,
      { filename: data.filename, mimetype: data.mimetype, data: buffer }
    );
    return reply.send({ data: result, statusCode: 200 });
  });

  // POST /api/files/post-media — upload media for community post
  fastify.post('/api/files/post-media', {
    preHandler: [fastify.authenticate],
  }, async (request, reply) => {
    const data = await request.file();
    if (!data) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', message: 'Keine Datei hochgeladen' });
    }
    const buffer = await data.toBuffer();
    const result = await filesService.uploadPostMedia(
      request.user.sub,
      request.user.orgId,
      { filename: data.filename, mimetype: data.mimetype, data: buffer }
    );
    return reply.send({ data: result, statusCode: 200 });
  });
}
