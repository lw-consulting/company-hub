import { eq, and, ilike, sql, asc, desc } from 'drizzle-orm';
import { db } from '../../config/database.js';
import { users } from '../../db/schema/users.js';
import { userModulePermissions } from '../../db/schema/user-module-permissions.js';
import { hashPassword } from '../../lib/password.js';
import { ConflictError, NotFoundError } from '../../lib/errors.js';
import { MODULES, type CreateUserInput, type UpdateUserInput, type ModuleId } from '@company-hub/shared';

export async function listUsers(orgId: string, opts: { page?: number; pageSize?: number; search?: string } = {}) {
  const page = opts.page || 1;
  const pageSize = opts.pageSize || 25;
  const offset = (page - 1) * pageSize;

  let query = db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      role: users.role,
      department: users.department,
      position: users.position,
      avatarUrl: users.avatarUrl,
      supervisorId: users.supervisorId,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.orgId, orgId))
    .orderBy(asc(users.lastName), asc(users.firstName))
    .limit(pageSize)
    .offset(offset);

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.orgId, orgId));

  const data = await query;
  const total = countResult?.count || 0;

  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function getUserById(userId: string) {
  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      role: users.role,
      department: users.department,
      position: users.position,
      phone: users.phone,
      avatarUrl: users.avatarUrl,
      supervisorId: users.supervisorId,
      orgId: users.orgId,
      vacationDaysPerYear: users.vacationDaysPerYear,
      weeklyTargetHours: users.weeklyTargetHours,
      isActive: users.isActive,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) throw new NotFoundError('Benutzer nicht gefunden');
  return user;
}

export async function createUser(input: CreateUserInput, orgId: string) {
  // Check for duplicate email
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, input.email.toLowerCase()))
    .limit(1);

  if (existing) throw new ConflictError('E-Mail-Adresse bereits vergeben');

  const passwordHash = await hashPassword(input.password);

  const [newUser] = await db
    .insert(users)
    .values({
      email: input.email.toLowerCase(),
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role || 'user',
      department: input.department,
      position: input.position,
      phone: input.phone,
      supervisorId: input.supervisorId,
      orgId,
      vacationDaysPerYear: input.vacationDaysPerYear ?? 25,
      weeklyTargetHours: String(input.weeklyTargetHours ?? 40),
    })
    .returning();

  // Grant default-enabled modules
  const defaultModules = MODULES.filter((m) => m.defaultEnabled).map((m) => ({
    userId: newUser.id,
    moduleId: m.id,
    isEnabled: true,
  }));

  if (defaultModules.length > 0) {
    await db.insert(userModulePermissions).values(defaultModules);
  }

  return getUserById(newUser.id);
}

export async function updateUser(userId: string, input: UpdateUserInput) {
  const updateData: Record<string, any> = { updatedAt: new Date() };

  if (input.email !== undefined) updateData.email = input.email.toLowerCase();
  if (input.firstName !== undefined) updateData.firstName = input.firstName;
  if (input.lastName !== undefined) updateData.lastName = input.lastName;
  if (input.role !== undefined) updateData.role = input.role;
  if (input.department !== undefined) updateData.department = input.department;
  if (input.position !== undefined) updateData.position = input.position;
  if (input.phone !== undefined) updateData.phone = input.phone;
  if (input.supervisorId !== undefined) updateData.supervisorId = input.supervisorId;
  if (input.vacationDaysPerYear !== undefined) updateData.vacationDaysPerYear = input.vacationDaysPerYear;
  if (input.weeklyTargetHours !== undefined) updateData.weeklyTargetHours = String(input.weeklyTargetHours);
  if (input.isActive !== undefined) updateData.isActive = input.isActive;

  const [updated] = await db
    .update(users)
    .set(updateData)
    .where(eq(users.id, userId))
    .returning();

  if (!updated) throw new NotFoundError('Benutzer nicht gefunden');

  return getUserById(userId);
}

export async function deleteUser(userId: string) {
  const [deleted] = await db.delete(users).where(eq(users.id, userId)).returning({ id: users.id });
  if (!deleted) throw new NotFoundError('Benutzer nicht gefunden');
}

export async function getUserModulePermissions(userId: string) {
  return db
    .select()
    .from(userModulePermissions)
    .where(eq(userModulePermissions.userId, userId));
}

export async function updateUserModulePermissions(
  userId: string,
  modules: { moduleId: string; isEnabled: boolean }[],
  grantedBy: string
) {
  // Upsert each module permission
  for (const mod of modules) {
    await db
      .insert(userModulePermissions)
      .values({
        userId,
        moduleId: mod.moduleId,
        isEnabled: mod.isEnabled,
        grantedBy,
      })
      .onConflictDoUpdate({
        target: [userModulePermissions.userId, userModulePermissions.moduleId],
        set: {
          isEnabled: mod.isEnabled,
          grantedBy,
          grantedAt: new Date(),
        },
      });
  }

  return getUserModulePermissions(userId);
}
