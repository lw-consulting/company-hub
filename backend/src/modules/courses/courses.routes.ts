import type { FastifyInstance } from 'fastify';
import * as coursesService from './courses.service.js';

export async function coursesRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);
  const modGuard = fastify.requireModule('courses');

  // --- Courses ---

  // GET /api/courses (admin: all, user: published only)
  fastify.get('/api/courses', { preHandler: [modGuard] }, async (req, reply) => {
    const isAdmin = ['super_admin', 'admin'].includes(req.user.role);
    const list = await coursesService.listCourses(req.user.orgId, !isAdmin);
    return reply.send({ data: list, statusCode: 200 });
  });

  fastify.get('/api/courses/:id', { preHandler: [modGuard] }, async (req, reply) => {
    const course = await coursesService.getCourseById((req.params as any).id);
    return reply.send({ data: course, statusCode: 200 });
  });

  fastify.post('/api/courses', { preHandler: [modGuard, fastify.requireRole('admin')] }, async (req, reply) => {
    const course = await coursesService.createCourse(req.user.orgId, req.user.sub, req.body as any);
    return reply.status(201).send({ data: course, statusCode: 201 });
  });

  fastify.patch('/api/courses/:id', { preHandler: [modGuard, fastify.requireRole('admin')] }, async (req, reply) => {
    const course = await coursesService.updateCourse((req.params as any).id, req.body);
    return reply.send({ data: course, statusCode: 200 });
  });

  fastify.delete('/api/courses/:id', { preHandler: [modGuard, fastify.requireRole('admin')] }, async (req, reply) => {
    await coursesService.deleteCourse((req.params as any).id);
    return reply.send({ data: { message: 'Kurs gelöscht' }, statusCode: 200 });
  });

  // --- Modules ---

  fastify.post('/api/courses/:courseId/modules', { preHandler: [modGuard, fastify.requireRole('admin')] }, async (req, reply) => {
    const mod = await coursesService.createModule((req.params as any).courseId, req.body as any);
    return reply.status(201).send({ data: mod, statusCode: 201 });
  });

  fastify.patch('/api/courses/modules/:id', { preHandler: [modGuard, fastify.requireRole('admin')] }, async (req, reply) => {
    const mod = await coursesService.updateModule((req.params as any).id, req.body as any);
    return reply.send({ data: mod, statusCode: 200 });
  });

  fastify.delete('/api/courses/modules/:id', { preHandler: [modGuard, fastify.requireRole('admin')] }, async (req, reply) => {
    await coursesService.deleteModule((req.params as any).id);
    return reply.send({ data: { message: 'Modul gelöscht' }, statusCode: 200 });
  });

  // --- Lessons ---

  fastify.post('/api/courses/modules/:moduleId/lessons', { preHandler: [modGuard, fastify.requireRole('admin')] }, async (req, reply) => {
    const lesson = await coursesService.createLesson((req.params as any).moduleId, req.body as any);
    return reply.status(201).send({ data: lesson, statusCode: 201 });
  });

  fastify.get('/api/courses/lessons/:id', { preHandler: [modGuard] }, async (req, reply) => {
    const lesson = await coursesService.getLessonById((req.params as any).id);
    return reply.send({ data: lesson, statusCode: 200 });
  });

  fastify.patch('/api/courses/lessons/:id', { preHandler: [modGuard, fastify.requireRole('admin')] }, async (req, reply) => {
    const lesson = await coursesService.updateLesson((req.params as any).id, req.body as any);
    return reply.send({ data: lesson, statusCode: 200 });
  });

  fastify.delete('/api/courses/lessons/:id', { preHandler: [modGuard, fastify.requireRole('admin')] }, async (req, reply) => {
    await coursesService.deleteLesson((req.params as any).id);
    return reply.send({ data: { message: 'Lektion gelöscht' }, statusCode: 200 });
  });

  // --- Enrollments ---

  fastify.post('/api/courses/:id/enroll', { preHandler: [modGuard] }, async (req, reply) => {
    const enrollment = await coursesService.enrollUser((req.params as any).id, req.user.sub);
    return reply.status(201).send({ data: enrollment, statusCode: 201 });
  });

  fastify.get('/api/courses/my-enrollments', { preHandler: [modGuard] }, async (req, reply) => {
    const enrollments = await coursesService.getMyEnrollments(req.user.sub);
    return reply.send({ data: enrollments, statusCode: 200 });
  });

  fastify.get('/api/courses/:id/progress', { preHandler: [modGuard] }, async (req, reply) => {
    const progress = await coursesService.getCourseProgress((req.params as any).id, req.user.sub);
    return reply.send({ data: progress, statusCode: 200 });
  });

  // --- Lesson Progress ---

  fastify.post('/api/courses/lessons/:id/progress', { preHandler: [modGuard] }, async (req, reply) => {
    const progress = await coursesService.updateLessonProgress((req.params as any).id, req.user.sub, req.body as any);
    return reply.send({ data: progress, statusCode: 200 });
  });
}
