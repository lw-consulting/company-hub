import type { FastifyInstance } from 'fastify';
import * as communityService from './community.service.js';

export async function communityRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);
  const modGuard = fastify.requireModule('community');

  // GET /api/community/feed
  fastify.get('/api/community/feed', { preHandler: [modGuard] }, async (request, reply) => {
    const { page, pageSize } = request.query as any;
    const feed = await communityService.getFeed(
      request.user.orgId,
      Number(page) || 1,
      Number(pageSize) || 20
    );
    return reply.send({ data: feed, statusCode: 200 });
  });

  // POST /api/community/posts
  fastify.post('/api/community/posts', { preHandler: [modGuard] }, async (request, reply) => {
    const data = request.body as any;
    const post = await communityService.createPost(request.user.sub, request.user.orgId, data);
    return reply.status(201).send({ data: post, statusCode: 201 });
  });

  // GET /api/community/posts/:id
  fastify.get('/api/community/posts/:id', { preHandler: [modGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const post = await communityService.getPostById(id, request.user.sub);
    return reply.send({ data: post, statusCode: 200 });
  });

  // DELETE /api/community/posts/:id
  fastify.delete('/api/community/posts/:id', { preHandler: [modGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await communityService.deletePost(id, request.user.sub);
    return reply.send({ data: { message: 'Beitrag gelöscht' }, statusCode: 200 });
  });

  // POST /api/community/posts/:id/pin (admin only)
  fastify.post('/api/community/posts/:id/pin', {
    preHandler: [modGuard, fastify.requireRole('admin')],
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const post = await communityService.togglePin(id);
    return reply.send({ data: post, statusCode: 200 });
  });

  // POST /api/community/posts/:id/like
  fastify.post('/api/community/posts/:id/like', { preHandler: [modGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = await communityService.toggleLike(request.user.sub, id);
    return reply.send({ data: result, statusCode: 200 });
  });

  // GET /api/community/posts/:id/comments
  fastify.get('/api/community/posts/:id/comments', { preHandler: [modGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const comments = await communityService.getComments(id);
    return reply.send({ data: comments, statusCode: 200 });
  });

  // POST /api/community/posts/:id/comments
  fastify.post('/api/community/posts/:id/comments', { preHandler: [modGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = request.body as any;
    const comment = await communityService.createComment(request.user.sub, id, data);
    return reply.status(201).send({ data: comment, statusCode: 201 });
  });

  // DELETE /api/community/comments/:id
  fastify.delete('/api/community/comments/:id', { preHandler: [modGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await communityService.deleteComment(id, request.user.sub);
    return reply.send({ data: { message: 'Kommentar gelöscht' }, statusCode: 200 });
  });

  // GET /api/community/profile/:userId
  fastify.get('/api/community/profile/:userId', { preHandler: [modGuard] }, async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const profile = await communityService.getUserProfile(userId, request.user.orgId);
    return reply.send({ data: profile, statusCode: 200 });
  });
}
