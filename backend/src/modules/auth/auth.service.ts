import { eq } from 'drizzle-orm';
import crypto from 'node:crypto';
import { db } from '../../config/database.js';
import { users } from '../../db/schema/users.js';
import { userModulePermissions } from '../../db/schema/user-module-permissions.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../lib/jwt.js';
import { UnauthorizedError } from '../../lib/errors.js';
import type { JwtPayload, AuthTokens, Role, ModuleId } from '@company-hub/shared';

function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function getUserModules(userId: string): Promise<ModuleId[]> {
  const perms = await db
    .select({ moduleId: userModulePermissions.moduleId })
    .from(userModulePermissions)
    .where(eq(userModulePermissions.userId, userId));

  return perms
    .filter((p) => p.moduleId)
    .map((p) => p.moduleId as ModuleId);
}

async function generateTokens(user: {
  id: string;
  email: string;
  role: string;
  orgId: string;
}): Promise<AuthTokens> {
  const modules = await getUserModules(user.id);

  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    role: user.role as Role,
    orgId: user.orgId,
    modules,
  };

  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(payload),
    signRefreshToken(user.id),
  ]);

  // Store hashed refresh token
  await db
    .update(users)
    .set({ refreshToken: hashRefreshToken(refreshToken) })
    .where(eq(users.id, user.id));

  return { accessToken, refreshToken };
}

export async function login(email: string, password: string): Promise<AuthTokens> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);

  // Constant-time: always verify even if user not found
  const isValid = user ? await verifyPassword(user.passwordHash, password) : false;

  if (!user || !isValid || !user.isActive) {
    throw new UnauthorizedError('Ungültige Anmeldedaten');
  }

  return generateTokens(user);
}

export async function refresh(refreshToken: string): Promise<AuthTokens> {
  const { sub } = await verifyRefreshToken(refreshToken).catch(() => {
    throw new UnauthorizedError('Refresh Token ungültig', 'REFRESH_TOKEN_INVALID');
  });

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, sub))
    .limit(1);

  if (!user || !user.isActive) {
    throw new UnauthorizedError('Benutzer nicht gefunden', 'REFRESH_TOKEN_INVALID');
  }

  // Verify stored hash matches
  const storedHash = user.refreshToken;
  const providedHash = hashRefreshToken(refreshToken);
  if (!storedHash || storedHash !== providedHash) {
    throw new UnauthorizedError('Refresh Token ungültig', 'REFRESH_TOKEN_INVALID');
  }

  return generateTokens(user);
}

export async function logout(userId: string): Promise<void> {
  await db.update(users).set({ refreshToken: null }).where(eq(users.id, userId));
}

export async function getMe(userId: string) {
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
      timeEditsRequireApproval: users.timeEditsRequireApproval,
      initialBalanceMinutes: users.initialBalanceMinutes,
      workingDays: users.workingDays,
      isActive: users.isActive,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return user || null;
}

export async function updateMe(
  userId: string,
  data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    weeklyTargetHours?: number | string;
    initialBalanceMinutes?: number;
    workingDays?: number[];
  }
) {
  const updateFields: Record<string, any> = { updatedAt: new Date() };
  if (data.firstName !== undefined) updateFields.firstName = data.firstName;
  if (data.lastName !== undefined) updateFields.lastName = data.lastName;
  if (data.phone !== undefined) updateFields.phone = data.phone;
  if (data.weeklyTargetHours !== undefined) updateFields.weeklyTargetHours = String(data.weeklyTargetHours);
  if (data.initialBalanceMinutes !== undefined) updateFields.initialBalanceMinutes = data.initialBalanceMinutes;
  if (data.workingDays !== undefined && Array.isArray(data.workingDays)) {
    updateFields.workingDays = data.workingDays.filter(d => Number.isInteger(d) && d >= 1 && d <= 7);
  }

  await db.update(users).set(updateFields).where(eq(users.id, userId));
  return getMe(userId);
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const [user] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) throw new UnauthorizedError('Benutzer nicht gefunden');

  const isValid = await verifyPassword(user.passwordHash, currentPassword);
  if (!isValid) throw new UnauthorizedError('Aktuelles Passwort ist falsch');

  const newHash = await hashPassword(newPassword);
  await db
    .update(users)
    .set({ passwordHash: newHash, refreshToken: null, updatedAt: new Date() })
    .where(eq(users.id, userId));
}
