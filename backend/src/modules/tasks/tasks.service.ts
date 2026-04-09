import { eq, and, desc, asc, sql, isNull, or } from 'drizzle-orm';
import { db } from '../../config/database.js';
import { tasks, taskComments } from '../../db/schema/tasks.js';
import { users } from '../../db/schema/users.js';
import { NotFoundError } from '../../lib/errors.js';
import { createNotification } from '../../lib/notification.service.js';

interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: string;
  assignedTo?: string;
  dueDate?: string;
}

export async function listTasks(
  orgId: string,
  userId: string,
  opts: { status?: string; assignedTo?: string; page?: number; pageSize?: number } = {}
) {
  const page = opts.page || 1;
  const pageSize = opts.pageSize || 50;
  const offset = (page - 1) * pageSize;

  // Build conditions
  const conditions = [eq(tasks.orgId, orgId)];

  if (opts.status) {
    conditions.push(eq(tasks.status, opts.status));
  }

  if (opts.assignedTo === 'me') {
    conditions.push(eq(tasks.assignedTo, userId));
  } else if (opts.assignedTo === 'created') {
    conditions.push(eq(tasks.createdBy, userId));
  }

  const result = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      status: tasks.status,
      priority: tasks.priority,
      dueDate: tasks.dueDate,
      completedAt: tasks.completedAt,
      createdAt: tasks.createdAt,
      createdById: tasks.createdBy,
      creatorFirstName: users.firstName,
      creatorLastName: users.lastName,
      assignedToId: tasks.assignedTo,
    })
    .from(tasks)
    .leftJoin(users, eq(tasks.createdBy, users.id))
    .where(and(...conditions))
    .orderBy(
      asc(sql`CASE WHEN ${tasks.status} = 'done' THEN 1 ELSE 0 END`),
      asc(sql`CASE WHEN ${tasks.priority} = 'urgent' THEN 0 WHEN ${tasks.priority} = 'high' THEN 1 WHEN ${tasks.priority} = 'medium' THEN 2 ELSE 3 END`),
      desc(tasks.createdAt)
    )
    .limit(pageSize)
    .offset(offset);

  // Get assignee names separately
  const withAssignees = await Promise.all(
    result.map(async (task) => {
      let assignee = null;
      if (task.assignedToId) {
        const [a] = await db
          .select({ firstName: users.firstName, lastName: users.lastName })
          .from(users)
          .where(eq(users.id, task.assignedToId))
          .limit(1);
        assignee = a || null;
      }
      return { ...task, assignee };
    })
  );

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(tasks)
    .where(and(...conditions));

  return {
    data: withAssignees,
    total: countResult?.count || 0,
    page,
    pageSize,
  };
}

export async function createTask(userId: string, orgId: string, data: CreateTaskInput) {
  const [task] = await db
    .insert(tasks)
    .values({
      orgId,
      title: data.title,
      description: data.description,
      priority: data.priority || 'medium',
      createdBy: userId,
      assignedTo: data.assignedTo || null,
      dueDate: data.dueDate || null,
    })
    .returning();

  // Notify assignee
  if (data.assignedTo && data.assignedTo !== userId) {
    const [creator] = await db
      .select({ firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    await createNotification({
      userId: data.assignedTo,
      type: 'task_assigned',
      title: 'Neue Aufgabe zugewiesen',
      body: `${creator?.firstName} ${creator?.lastName} hat Ihnen die Aufgabe "${data.title}" zugewiesen.`,
      link: '/tasks',
      moduleId: 'tasks',
    });
  }

  return task;
}

export async function getTaskById(taskId: string) {
  const [task] = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .limit(1);

  if (!task) throw new NotFoundError('Aufgabe nicht gefunden');

  // Get comments
  const comments = await db
    .select({
      id: taskComments.id,
      content: taskComments.content,
      createdAt: taskComments.createdAt,
      authorId: taskComments.authorId,
      authorFirstName: users.firstName,
      authorLastName: users.lastName,
    })
    .from(taskComments)
    .innerJoin(users, eq(taskComments.authorId, users.id))
    .where(eq(taskComments.taskId, taskId))
    .orderBy(taskComments.createdAt);

  return { ...task, comments };
}

export async function updateTask(
  taskId: string,
  data: {
    title?: string;
    description?: string;
    status?: string;
    priority?: string;
    assignedTo?: string | null;
    dueDate?: string | null;
  }
) {
  const updateData: Record<string, any> = { updatedAt: new Date() };

  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.assignedTo !== undefined) updateData.assignedTo = data.assignedTo;
  if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;

  if (data.status !== undefined) {
    updateData.status = data.status;
    if (data.status === 'done') {
      updateData.completedAt = new Date();
    } else {
      updateData.completedAt = null;
    }
  }

  const [task] = await db
    .update(tasks)
    .set(updateData)
    .where(eq(tasks.id, taskId))
    .returning();

  if (!task) throw new NotFoundError('Aufgabe nicht gefunden');
  return task;
}

export async function deleteTask(taskId: string) {
  const [deleted] = await db
    .delete(tasks)
    .where(eq(tasks.id, taskId))
    .returning({ id: tasks.id });

  if (!deleted) throw new NotFoundError('Aufgabe nicht gefunden');
}

export async function addComment(taskId: string, userId: string, content: string) {
  const [comment] = await db
    .insert(taskComments)
    .values({ taskId, authorId: userId, content })
    .returning();

  return comment;
}
