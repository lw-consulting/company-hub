import type { FastifyInstance } from 'fastify';
import * as communityService from './community.service.js';

export async function communityRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);
  const modGuard = fastify.requireModule('community');

  // ============== FORUMS ==============

  fastify.get('/api/community/forums', { preHandler: [modGuard] }, async (req, reply) => {
    const forums = await communityService.getForumStructure(req.user.orgId);
    return reply.send({ data: forums, statusCode: 200 });
  });

  fastify.post('/api/community/forum-groups', { preHandler: [modGuard, fastify.requireRole('admin')] }, async (req, reply) => {
    const group = await communityService.createForumGroup(req.user.orgId, req.body as any);
    return reply.status(201).send({ data: group, statusCode: 201 });
  });

  fastify.post('/api/community/forums', { preHandler: [modGuard, fastify.requireRole('admin')] }, async (req, reply) => {
    const { groupId, ...data } = req.body as any;
    const forum = await communityService.createForum(req.user.orgId, groupId, data);
    return reply.status(201).send({ data: forum, statusCode: 201 });
  });

  fastify.delete('/api/community/forums/:id', { preHandler: [modGuard, fastify.requireRole('admin')] }, async (req, reply) => {
    await communityService.deleteForum((req.params as any).id);
    return reply.send({ data: { message: 'Forum gelöscht' }, statusCode: 200 });
  });

  // ============== FEED ==============

  fastify.get('/api/community/feed', { preHandler: [modGuard] }, async (req, reply) => {
    const { page, pageSize, forumId, userId } = req.query as any;
    const feed = await communityService.getFeed(req.user.orgId, {
      page: Number(page) || 1, pageSize: Number(pageSize) || 20, forumId, userId,
      currentUserId: req.user.sub,
    });
    return reply.send({ data: feed, statusCode: 200 });
  });

  // ============== POSTS ==============

  fastify.post('/api/community/posts', { preHandler: [modGuard] }, async (req, reply) => {
    const post = await communityService.createPost(req.user.sub, req.user.orgId, req.body as any);
    return reply.status(201).send({ data: post, statusCode: 201 });
  });

  fastify.get('/api/community/posts/:id', { preHandler: [modGuard] }, async (req, reply) => {
    const post = await communityService.getPostById((req.params as any).id, req.user.sub);
    return reply.send({ data: post, statusCode: 200 });
  });

  fastify.patch('/api/community/posts/:id', { preHandler: [modGuard] }, async (req, reply) => {
    const updated = await communityService.updatePost((req.params as any).id, req.user.sub, req.body as any);
    return reply.send({ data: updated, statusCode: 200 });
  });

  fastify.delete('/api/community/posts/:id', { preHandler: [modGuard] }, async (req, reply) => {
    await communityService.deletePost((req.params as any).id, req.user.sub);
    return reply.send({ data: { message: 'Gelöscht' }, statusCode: 200 });
  });

  fastify.post('/api/community/posts/:id/pin', { preHandler: [modGuard, fastify.requireRole('admin')] }, async (req, reply) => {
    const post = await communityService.togglePin((req.params as any).id);
    return reply.send({ data: post, statusCode: 200 });
  });

  fastify.post('/api/community/posts/:id/highlight', { preHandler: [modGuard, fastify.requireRole('admin')] }, async (req, reply) => {
    const post = await communityService.toggleHighlight((req.params as any).id);
    return reply.send({ data: post, statusCode: 200 });
  });

  // ============== REACTIONS & BOOKMARKS ==============

  fastify.post('/api/community/posts/:id/react', { preHandler: [modGuard] }, async (req, reply) => {
    const { type } = (req.body as any) || {};
    const result = await communityService.toggleReaction(req.user.sub, (req.params as any).id, type || 'like');
    return reply.send({ data: result, statusCode: 200 });
  });

  // Keep old like endpoint for backward compat
  fastify.post('/api/community/posts/:id/like', { preHandler: [modGuard] }, async (req, reply) => {
    const result = await communityService.toggleLike(req.user.sub, (req.params as any).id);
    return reply.send({ data: result, statusCode: 200 });
  });

  // ============== POLLS ==============

  fastify.post('/api/community/polls/:optionId/vote', { preHandler: [modGuard] }, async (req, reply) => {
    const result = await communityService.votePoll(req.user.sub, (req.params as any).optionId);
    return reply.send({ data: result, statusCode: 200 });
  });

  fastify.post('/api/community/posts/:id/bookmark', { preHandler: [modGuard] }, async (req, reply) => {
    const result = await communityService.toggleBookmark(req.user.sub, (req.params as any).id);
    return reply.send({ data: result, statusCode: 200 });
  });

  fastify.get('/api/community/saved', { preHandler: [modGuard] }, async (req, reply) => {
    const posts = await communityService.getSavedPosts(req.user.sub);
    return reply.send({ data: posts, statusCode: 200 });
  });

  // ============== COMMENTS ==============

  fastify.get('/api/community/posts/:id/comments', { preHandler: [modGuard] }, async (req, reply) => {
    const comments = await communityService.getComments((req.params as any).id);
    return reply.send({ data: comments, statusCode: 200 });
  });

  fastify.post('/api/community/posts/:id/comments', { preHandler: [modGuard] }, async (req, reply) => {
    const comment = await communityService.createComment(req.user.sub, (req.params as any).id, req.body as any);
    return reply.status(201).send({ data: comment, statusCode: 201 });
  });

  fastify.delete('/api/community/comments/:id', { preHandler: [modGuard] }, async (req, reply) => {
    await communityService.deleteComment((req.params as any).id, req.user.sub);
    return reply.send({ data: { message: 'Gelöscht' }, statusCode: 200 });
  });

  // ============== FOLLOWS ==============

  fastify.post('/api/community/users/:id/follow', { preHandler: [modGuard] }, async (req, reply) => {
    const result = await communityService.toggleFollow(req.user.sub, (req.params as any).id);
    return reply.send({ data: result, statusCode: 200 });
  });

  // ============== PROFILE ==============

  fastify.get('/api/community/profile/:userId', { preHandler: [modGuard] }, async (req, reply) => {
    const profile = await communityService.getUserProfile((req.params as any).userId, req.user.sub);
    return reply.send({ data: profile, statusCode: 200 });
  });

  fastify.get('/api/community/my-profile', { preHandler: [modGuard] }, async (req, reply) => {
    const profile = await communityService.getUserProfile(req.user.sub);
    return reply.send({ data: profile, statusCode: 200 });
  });

  fastify.patch('/api/community/my-profile', { preHandler: [modGuard] }, async (req, reply) => {
    const profile = await communityService.updateProfile(req.user.sub, req.body as any);
    return reply.send({ data: profile, statusCode: 200 });
  });
}
