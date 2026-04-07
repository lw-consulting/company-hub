import { pgTable, uuid, varchar, text, boolean, integer, numeric, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { organizations } from './organizations.js';

/** Course */
export const courses = pgTable(
  'courses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 300 }).notNull(),
    description: text('description'),
    thumbnailUrl: text('thumbnail_url'),
    isPublished: boolean('is_published').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_courses_org').on(table.orgId),
  ]
);

/** Course Module (section/chapter within a course) */
export const courseModules = pgTable(
  'course_modules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 300 }).notNull(),
    description: text('description'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_course_modules_course').on(table.courseId),
  ]
);

/** Course Lesson (individual content piece) */
export const courseLessons = pgTable(
  'course_lessons',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    moduleId: uuid('module_id').notNull().references(() => courseModules.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 300 }).notNull(),
    contentType: varchar('content_type', { length: 20 }).notNull().default('text'), // text, video, mixed
    textContent: text('text_content'),
    videoUrl: text('video_url'),
    videoDurationSeconds: integer('video_duration_seconds'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_course_lessons_module').on(table.moduleId),
  ]
);

/** User enrollment in a course */
export const courseEnrollments = pgTable(
  'course_enrollments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    courseId: uuid('course_id').notNull().references(() => courses.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    enrolledAt: timestamp('enrolled_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    index('idx_enrollments_user').on(table.userId),
    index('idx_enrollments_course').on(table.courseId),
  ]
);

/** Progress tracking per lesson */
export const lessonProgress = pgTable(
  'lesson_progress',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    lessonId: uuid('lesson_id').notNull().references(() => courseLessons.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    completed: boolean('completed').notNull().default(false),
    progressPercent: integer('progress_percent').notNull().default(0),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('idx_lesson_progress_user').on(table.userId),
    index('idx_lesson_progress_lesson').on(table.lessonId),
  ]
);
