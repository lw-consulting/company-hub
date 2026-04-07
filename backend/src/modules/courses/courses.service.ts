import { eq, and, desc, asc, sql } from 'drizzle-orm';
import { db } from '../../config/database.js';
import { courses, courseModules, courseLessons, courseEnrollments, lessonProgress } from '../../db/schema/courses.js';
import { NotFoundError } from '../../lib/errors.js';

// --- Courses ---

export async function listCourses(orgId: string, onlyPublished = false) {
  const conditions = [eq(courses.orgId, orgId)];
  if (onlyPublished) conditions.push(eq(courses.isPublished, true));

  return db.select().from(courses)
    .where(and(...conditions))
    .orderBy(courses.sortOrder, desc(courses.createdAt));
}

export async function getCourseById(courseId: string) {
  const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
  if (!course) throw new NotFoundError('Kurs nicht gefunden');

  const modules = await db.select().from(courseModules)
    .where(eq(courseModules.courseId, courseId))
    .orderBy(courseModules.sortOrder);

  const modulesWithLessons = await Promise.all(modules.map(async (mod) => {
    const lessons = await db.select().from(courseLessons)
      .where(eq(courseLessons.moduleId, mod.id))
      .orderBy(courseLessons.sortOrder);
    return { ...mod, lessons };
  }));

  return { ...course, modules: modulesWithLessons };
}

export async function createCourse(orgId: string, userId: string, data: { title: string; description?: string; thumbnailUrl?: string }) {
  const [course] = await db.insert(courses).values({
    orgId, createdBy: userId, title: data.title, description: data.description, thumbnailUrl: data.thumbnailUrl,
  }).returning();
  return course;
}

export async function updateCourse(courseId: string, data: any) {
  const updateData: Record<string, any> = { updatedAt: new Date() };
  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.thumbnailUrl !== undefined) updateData.thumbnailUrl = data.thumbnailUrl;
  if (data.isPublished !== undefined) updateData.isPublished = data.isPublished;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

  const [updated] = await db.update(courses).set(updateData).where(eq(courses.id, courseId)).returning();
  if (!updated) throw new NotFoundError('Kurs nicht gefunden');
  return updated;
}

export async function deleteCourse(courseId: string) {
  await db.delete(courses).where(eq(courses.id, courseId));
}

// --- Modules ---

export async function createModule(courseId: string, data: { title: string; description?: string }) {
  const [existing] = await db.select({ count: sql<number>`count(*)::int` })
    .from(courseModules).where(eq(courseModules.courseId, courseId));
  const sortOrder = (existing?.count || 0);

  const [mod] = await db.insert(courseModules).values({
    courseId, title: data.title, description: data.description, sortOrder,
  }).returning();
  return mod;
}

export async function updateModule(moduleId: string, data: { title?: string; description?: string; sortOrder?: number }) {
  const updateData: Record<string, any> = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

  const [updated] = await db.update(courseModules).set(updateData).where(eq(courseModules.id, moduleId)).returning();
  if (!updated) throw new NotFoundError('Modul nicht gefunden');
  return updated;
}

export async function deleteModule(moduleId: string) {
  await db.delete(courseModules).where(eq(courseModules.id, moduleId));
}

// --- Lessons ---

export async function createLesson(moduleId: string, data: {
  title: string; contentType?: string; textContent?: string; videoUrl?: string; videoDurationSeconds?: number;
}) {
  const [existing] = await db.select({ count: sql<number>`count(*)::int` })
    .from(courseLessons).where(eq(courseLessons.moduleId, moduleId));
  const sortOrder = (existing?.count || 0);

  const [lesson] = await db.insert(courseLessons).values({
    moduleId, title: data.title, contentType: data.contentType || 'text',
    textContent: data.textContent, videoUrl: data.videoUrl,
    videoDurationSeconds: data.videoDurationSeconds, sortOrder,
  }).returning();
  return lesson;
}

export async function updateLesson(lessonId: string, data: any) {
  const updateData: Record<string, any> = { updatedAt: new Date() };
  const fields = ['title', 'contentType', 'textContent', 'videoUrl', 'videoDurationSeconds', 'sortOrder'];
  for (const f of fields) {
    if (data[f] !== undefined) updateData[f] = data[f];
  }

  const [updated] = await db.update(courseLessons).set(updateData).where(eq(courseLessons.id, lessonId)).returning();
  if (!updated) throw new NotFoundError('Lektion nicht gefunden');
  return updated;
}

export async function deleteLesson(lessonId: string) {
  await db.delete(courseLessons).where(eq(courseLessons.id, lessonId));
}

export async function getLessonById(lessonId: string) {
  const [lesson] = await db.select().from(courseLessons).where(eq(courseLessons.id, lessonId)).limit(1);
  if (!lesson) throw new NotFoundError('Lektion nicht gefunden');
  return lesson;
}

// --- Enrollments & Progress ---

export async function enrollUser(courseId: string, userId: string) {
  const [enrollment] = await db.insert(courseEnrollments).values({ courseId, userId }).returning();
  return enrollment;
}

export async function getMyEnrollments(userId: string) {
  const enrollments = await db
    .select({
      id: courseEnrollments.id,
      courseId: courseEnrollments.courseId,
      enrolledAt: courseEnrollments.enrolledAt,
      completedAt: courseEnrollments.completedAt,
      courseTitle: courses.title,
      courseDescription: courses.description,
      courseThumbnail: courses.thumbnailUrl,
    })
    .from(courseEnrollments)
    .innerJoin(courses, eq(courseEnrollments.courseId, courses.id))
    .where(eq(courseEnrollments.userId, userId))
    .orderBy(desc(courseEnrollments.enrolledAt));
  return enrollments;
}

export async function getCourseProgress(courseId: string, userId: string) {
  // Get all lessons in this course
  const modules = await db.select({ id: courseModules.id })
    .from(courseModules).where(eq(courseModules.courseId, courseId));
  const moduleIds = modules.map(m => m.id);
  if (moduleIds.length === 0) return { totalLessons: 0, completedLessons: 0, progressPercent: 0 };

  let totalLessons = 0;
  let completedLessons = 0;

  for (const modId of moduleIds) {
    const lessons = await db.select({ id: courseLessons.id })
      .from(courseLessons).where(eq(courseLessons.moduleId, modId));

    for (const lesson of lessons) {
      totalLessons++;
      const [progress] = await db.select({ completed: lessonProgress.completed })
        .from(lessonProgress)
        .where(and(eq(lessonProgress.lessonId, lesson.id), eq(lessonProgress.userId, userId)))
        .limit(1);
      if (progress?.completed) completedLessons++;
    }
  }

  return {
    totalLessons,
    completedLessons,
    progressPercent: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
  };
}

export async function updateLessonProgress(lessonId: string, userId: string, data: { completed?: boolean; progressPercent?: number }) {
  const [existing] = await db.select().from(lessonProgress)
    .where(and(eq(lessonProgress.lessonId, lessonId), eq(lessonProgress.userId, userId)))
    .limit(1);

  if (existing) {
    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (data.completed !== undefined) {
      updateData.completed = data.completed;
      if (data.completed) updateData.completedAt = new Date();
    }
    if (data.progressPercent !== undefined) updateData.progressPercent = data.progressPercent;

    const [updated] = await db.update(lessonProgress).set(updateData)
      .where(eq(lessonProgress.id, existing.id)).returning();
    return updated;
  } else {
    const [created] = await db.insert(lessonProgress).values({
      lessonId, userId, completed: data.completed || false,
      progressPercent: data.progressPercent || 0,
      completedAt: data.completed ? new Date() : null,
    }).returning();
    return created;
  }
}
