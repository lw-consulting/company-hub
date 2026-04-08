import { eq, and, gte, lte, isNull, desc, sql } from 'drizzle-orm';
import { db } from '../../config/database.js';
import { timeEntries } from '../../db/schema/time-tracking.js';
import { organizations } from '../../db/schema/organizations.js';
import { users } from '../../db/schema/users.js';
import { AppError, ConflictError, NotFoundError } from '../../lib/errors.js';

/** Clock in - creates a new time entry without clockOut */
export async function clockIn(userId: string, orgId: string, notes?: string) {
  // Check if already clocked in
  const [active] = await db
    .select({ id: timeEntries.id })
    .from(timeEntries)
    .where(and(eq(timeEntries.userId, userId), isNull(timeEntries.clockOut)))
    .limit(1);

  if (active) {
    throw new ConflictError('Bereits eingestempelt. Bitte zuerst ausstempeln.');
  }

  const [entry] = await db
    .insert(timeEntries)
    .values({
      userId,
      orgId,
      clockIn: new Date(),
      notes,
    })
    .returning();

  return entry;
}

/** Clock out - sets clockOut on active entry, applies auto-break if needed */
export async function clockOut(userId: string, orgId: string, notes?: string) {
  const [active] = await db
    .select()
    .from(timeEntries)
    .where(and(eq(timeEntries.userId, userId), isNull(timeEntries.clockOut)))
    .limit(1);

  if (!active) {
    throw new ConflictError('Nicht eingestempelt. Bitte zuerst einstempeln.');
  }

  const now = new Date();
  const durationMinutes = (now.getTime() - active.clockIn.getTime()) / 60000;

  // Get org settings for auto-break
  const [org] = await db
    .select({
      breakAfterMinutes: organizations.breakAfterMinutes,
      breakDurationMinutes: organizations.breakDurationMinutes,
    })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  let breakMinutes = active.breakMinutes;
  let autoBreakApplied = false;

  // Auto-break: if duration >= threshold and no/insufficient break logged
  if (org && durationMinutes >= org.breakAfterMinutes && breakMinutes < org.breakDurationMinutes) {
    breakMinutes = org.breakDurationMinutes;
    autoBreakApplied = true;
  }

  const updateData: Record<string, any> = {
    clockOut: now,
    breakMinutes,
    autoBreakApplied,
    updatedAt: now,
  };
  if (notes) updateData.notes = notes;

  const [entry] = await db
    .update(timeEntries)
    .set(updateData)
    .where(eq(timeEntries.id, active.id))
    .returning();

  return entry;
}

/** Get current active entry (clocked in but not out) */
export async function getActiveEntry(userId: string) {
  const [active] = await db
    .select()
    .from(timeEntries)
    .where(and(eq(timeEntries.userId, userId), isNull(timeEntries.clockOut)))
    .limit(1);

  return active || null;
}

/** Get entries for a date range */
export async function getEntries(
  userId: string,
  startDate: string,
  endDate: string
) {
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T23:59:59');

  return db
    .select()
    .from(timeEntries)
    .where(
      and(
        eq(timeEntries.userId, userId),
        gte(timeEntries.clockIn, start),
        lte(timeEntries.clockIn, end)
      )
    )
    .orderBy(desc(timeEntries.clockIn));
}

/** Calculate working hours summary for a period */
export async function getSummary(
  userId: string,
  startDate: string,
  endDate: string
) {
  const entries = await getEntries(userId, startDate, endDate);

  let totalMinutes = 0;
  let totalBreakMinutes = 0;
  let daysWorked = new Set<string>();

  for (const entry of entries) {
    if (entry.clockOut) {
      const duration = (entry.clockOut.getTime() - entry.clockIn.getTime()) / 60000;
      totalMinutes += duration - entry.breakMinutes;
      totalBreakMinutes += entry.breakMinutes;
      daysWorked.add(entry.clockIn.toISOString().split('T')[0]);
    }
  }

  // Get user settings
  const [user] = await db
    .select({
      weeklyTargetHours: users.weeklyTargetHours,
      workingDays: users.workingDays,
      initialBalanceMinutes: users.initialBalanceMinutes,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const weeklyTarget = parseFloat(String(user?.weeklyTargetHours || '40'));
  const workingDays = (user?.workingDays as number[]) || [1, 2, 3, 4, 5];
  const initialBalanceMinutes = user?.initialBalanceMinutes || 0;
  const dailyTarget = workingDays.length > 0 ? weeklyTarget / workingDays.length : weeklyTarget / 5;

  // Count working days in the given range based on user's workingDays setting
  const startD = new Date(startDate);
  const endD = new Date(endDate);
  let workingDaysInRange = 0;
  for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
    // JS: 0=Sun, 1=Mon, ..., 6=Sat → convert to 1=Mon..7=Sun
    const dayNum = d.getDay() === 0 ? 7 : d.getDay();
    if (workingDays.includes(dayNum)) workingDaysInRange++;
  }
  const targetMinutes = workingDaysInRange * dailyTarget * 60;

  return {
    totalHours: Math.round((totalMinutes / 60) * 100) / 100,
    totalMinutes: Math.round(totalMinutes),
    totalBreakMinutes,
    daysWorked: daysWorked.size,
    targetHours: Math.round((targetMinutes / 60) * 100) / 100,
    balanceHours: Math.round(((totalMinutes - targetMinutes) / 60) * 100) / 100,
    // Cumulative balance including initial carryover (for dashboard "lifetime saldo")
    initialBalanceMinutes,
    initialBalanceHours: Math.round((initialBalanceMinutes / 60) * 100) / 100,
    dailyTargetHours: dailyTarget,
    weeklyTargetHours: weeklyTarget,
    workingDays,
    entries: entries.map((e) => ({
      ...e,
      durationMinutes: e.clockOut
        ? Math.round((e.clockOut.getTime() - e.clockIn.getTime()) / 60000)
        : null,
      netMinutes: e.clockOut
        ? Math.round((e.clockOut.getTime() - e.clockIn.getTime()) / 60000) - e.breakMinutes
        : null,
    })),
  };
}

/** Update a time entry (for corrections by supervisor) */
export async function updateEntry(
  entryId: string,
  data: {
    clockIn?: string;
    clockOut?: string;
    breakMinutes?: number;
    notes?: string;
  },
  correctedBy: string
) {
  const updateData: Record<string, any> = {
    correctedBy,
    correctionNote: `Korrektur durch Vorgesetzten`,
    updatedAt: new Date(),
  };

  if (data.clockIn) updateData.clockIn = new Date(data.clockIn);
  if (data.clockOut) updateData.clockOut = new Date(data.clockOut);
  if (data.breakMinutes !== undefined) updateData.breakMinutes = data.breakMinutes;
  if (data.notes) updateData.notes = data.notes;

  const [entry] = await db
    .update(timeEntries)
    .set(updateData)
    .where(eq(timeEntries.id, entryId))
    .returning();

  if (!entry) throw new NotFoundError('Zeiteintrag nicht gefunden');
  return entry;
}

/** User edits their own time entry (marked as userEdited) */
export async function updateOwnEntry(
  entryId: string,
  userId: string,
  data: {
    clockIn?: string;
    clockOut?: string;
    breakMinutes?: number;
    notes?: string;
  }
) {
  const [existing] = await db
    .select()
    .from(timeEntries)
    .where(and(eq(timeEntries.id, entryId), eq(timeEntries.userId, userId)))
    .limit(1);

  if (!existing) throw new NotFoundError('Zeiteintrag nicht gefunden');

  const now = new Date();
  const updateData: Record<string, any> = {
    userEdited: true,
    userEditedAt: now,
    updatedAt: now,
  };

  if (data.clockIn) updateData.clockIn = new Date(data.clockIn);
  if (data.clockOut) updateData.clockOut = new Date(data.clockOut);
  if (data.breakMinutes !== undefined) updateData.breakMinutes = data.breakMinutes;
  if (data.notes !== undefined) updateData.notes = data.notes;

  const [entry] = await db
    .update(timeEntries)
    .set(updateData)
    .where(and(eq(timeEntries.id, entryId), eq(timeEntries.userId, userId)))
    .returning();

  return entry;
}

/** Add break minutes to the currently active entry */
export async function addBreak(userId: string, minutes: number) {
  if (minutes <= 0) throw new AppError(400, 'VALIDATION_ERROR', 'Pause muss größer als 0 sein');

  const [active] = await db
    .select()
    .from(timeEntries)
    .where(and(eq(timeEntries.userId, userId), isNull(timeEntries.clockOut)))
    .limit(1);

  if (!active) throw new ConflictError('Nicht eingestempelt. Bitte zuerst "Kommen" buchen.');

  const [entry] = await db
    .update(timeEntries)
    .set({
      breakMinutes: active.breakMinutes + minutes,
      updatedAt: new Date(),
    })
    .where(eq(timeEntries.id, active.id))
    .returning();

  return entry;
}

/** Get team entries for a manager to review */
export async function getTeamEntries(
  supervisorId: string,
  orgId: string,
  date: string
) {
  const start = new Date(date + 'T00:00:00');
  const end = new Date(date + 'T23:59:59');

  // Get all users who have this supervisor
  const teamUsers = await db
    .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(and(eq(users.supervisorId, supervisorId), eq(users.orgId, orgId)));

  const results = [];
  for (const u of teamUsers) {
    const entries = await db
      .select()
      .from(timeEntries)
      .where(
        and(
          eq(timeEntries.userId, u.id),
          gte(timeEntries.clockIn, start),
          lte(timeEntries.clockIn, end)
        )
      )
      .orderBy(timeEntries.clockIn);

    results.push({
      user: u,
      entries,
    });
  }

  return results;
}
