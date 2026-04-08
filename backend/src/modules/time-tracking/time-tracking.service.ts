import { eq, and, gte, lte, isNull, desc, inArray, asc } from 'drizzle-orm';
import { db } from '../../config/database.js';
import { timeEntries, timeEntryBreaks } from '../../db/schema/time-tracking.js';
import { organizations } from '../../db/schema/organizations.js';
import { users } from '../../db/schema/users.js';
import { AppError, ConflictError, NotFoundError } from '../../lib/errors.js';
import { calculateActualBreakMinutes, calculateBookedBreakMinutes } from './time-tracking.logic.js';

async function getBreakPolicy(orgId: string) {
  const [org] = await db
    .select({
      breakAfterMinutes: organizations.breakAfterMinutes,
      breakDurationMinutes: organizations.breakDurationMinutes,
    })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);

  return {
    companyThresholdMinutes: org?.breakAfterMinutes ?? 360,
    companyMinBreakMinutes: org?.breakDurationMinutes ?? 30,
  };
}

async function getBreaksByEntryIds(entryIds: string[]) {
  const map = new Map<string, typeof timeEntryBreaks.$inferSelect[]>();
  if (entryIds.length === 0) {
    return map;
  }

  const breaks = await db
    .select()
    .from(timeEntryBreaks)
    .where(inArray(timeEntryBreaks.timeEntryId, entryIds))
    .orderBy(asc(timeEntryBreaks.startedAt));

  for (const item of breaks) {
    const current = map.get(item.timeEntryId) ?? [];
    current.push(item);
    map.set(item.timeEntryId, current);
  }

  return map;
}

function serializeBreaks(
  breaks: typeof timeEntryBreaks.$inferSelect[],
  asOf: Date,
) {
  return breaks.map((entryBreak) => ({
    ...entryBreak,
    durationMinutes: Math.max(
      0,
      Math.round(((entryBreak.endedAt ?? asOf).getTime() - entryBreak.startedAt.getTime()) / 60000),
    ),
  }));
}

async function decorateEntry(entry: typeof timeEntries.$inferSelect, asOf: Date = new Date()) {
  const breaksByEntry = await getBreaksByEntryIds([entry.id]);
  const breaks = breaksByEntry.get(entry.id) ?? [];
  const actualBreakMinutes = calculateActualBreakMinutes(breaks, asOf);
  const openBreak = breaks.find((item) => item.endedAt === null) ?? null;
  const durationMinutes = entry.clockOut
    ? Math.round((entry.clockOut.getTime() - entry.clockIn.getTime()) / 60000)
    : Math.round((asOf.getTime() - entry.clockIn.getTime()) / 60000);
  const effectiveBreakMinutes = entry.clockOut
    ? entry.breakMinutes
    : calculateBookedBreakMinutes(durationMinutes, actualBreakMinutes, await getBreakPolicy(entry.orgId));

  return {
    ...entry,
    breakMinutes: entry.clockOut ? entry.breakMinutes : actualBreakMinutes,
    actualBreakMinutes,
    effectiveBreakMinutes,
    isOnBreak: Boolean(openBreak),
    activeBreakStartedAt: openBreak?.startedAt ?? null,
    breaks: serializeBreaks(breaks, asOf),
  };
}

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
  const [openBreak] = await db
    .select()
    .from(timeEntryBreaks)
    .where(and(eq(timeEntryBreaks.timeEntryId, active.id), isNull(timeEntryBreaks.endedAt)))
    .limit(1);

  if (openBreak) {
    await db
      .update(timeEntryBreaks)
      .set({
        endedAt: now,
        updatedAt: now,
      })
      .where(eq(timeEntryBreaks.id, openBreak.id));
  }

  const breaksByEntry = await getBreaksByEntryIds([active.id]);
  const actualBreakMinutes = calculateActualBreakMinutes(breaksByEntry.get(active.id) ?? [], now);
  const durationMinutes = Math.round((now.getTime() - active.clockIn.getTime()) / 60000);
  const breakPolicy = await getBreakPolicy(orgId);
  const breakMinutes = calculateBookedBreakMinutes(durationMinutes, actualBreakMinutes, breakPolicy);
  const autoBreakApplied = breakMinutes > actualBreakMinutes;

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

  return decorateEntry(entry, now);
}

/** Get current active entry (clocked in but not out) */
export async function getActiveEntry(userId: string) {
  const [active] = await db
    .select()
    .from(timeEntries)
    .where(and(eq(timeEntries.userId, userId), isNull(timeEntries.clockOut)))
    .limit(1);

  if (!active) {
    return null;
  }

  return decorateEntry(active);
}

/** Get entries for a date range */
export async function getEntries(
  userId: string,
  startDate: string,
  endDate: string
) {
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T23:59:59');

  const entries = await db
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

  const breaksByEntry = await getBreaksByEntryIds(entries.map((entry) => entry.id));
  return entries.map((entry) => {
    const breaks = breaksByEntry.get(entry.id) ?? [];
    const asOf = entry.clockOut ?? new Date();
    return {
      ...entry,
      actualBreakMinutes: calculateActualBreakMinutes(breaks, asOf),
      effectiveBreakMinutes: entry.breakMinutes,
      isOnBreak: false,
      activeBreakStartedAt: null,
      breaks: serializeBreaks(breaks, asOf),
    };
  });
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
  if (data.breakMinutes !== undefined) {
    updateData.breakMinutes = data.breakMinutes;
    updateData.autoBreakApplied = false;
  }
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
  if (data.breakMinutes !== undefined) {
    updateData.breakMinutes = data.breakMinutes;
    updateData.autoBreakApplied = false;
  }
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

  const [openBreak] = await db
    .select({ id: timeEntryBreaks.id })
    .from(timeEntryBreaks)
    .where(and(eq(timeEntryBreaks.timeEntryId, active.id), isNull(timeEntryBreaks.endedAt)))
    .limit(1);

  if (openBreak) {
    throw new ConflictError('Es läuft bereits eine Pause. Bitte zuerst die laufende Pause beenden.');
  }

  const now = new Date();
  const startedAt = new Date(now.getTime() - minutes * 60000);
  await db.insert(timeEntryBreaks).values({
    timeEntryId: active.id,
    userId: active.userId,
    orgId: active.orgId,
    startedAt,
    endedAt: now,
  });

  return getActiveEntry(userId);
}

export async function startBreak(userId: string) {
  const [active] = await db
    .select()
    .from(timeEntries)
    .where(and(eq(timeEntries.userId, userId), isNull(timeEntries.clockOut)))
    .limit(1);

  if (!active) {
    throw new ConflictError('Nicht eingestempelt. Bitte zuerst "Kommen" buchen.');
  }

  const [openBreak] = await db
    .select({ id: timeEntryBreaks.id })
    .from(timeEntryBreaks)
    .where(and(eq(timeEntryBreaks.timeEntryId, active.id), isNull(timeEntryBreaks.endedAt)))
    .limit(1);

  if (openBreak) {
    throw new ConflictError('Es läuft bereits eine Pause.');
  }

  await db.insert(timeEntryBreaks).values({
    timeEntryId: active.id,
    userId: active.userId,
    orgId: active.orgId,
    startedAt: new Date(),
  });

  return getActiveEntry(userId);
}

export async function endBreak(userId: string) {
  const [active] = await db
    .select()
    .from(timeEntries)
    .where(and(eq(timeEntries.userId, userId), isNull(timeEntries.clockOut)))
    .limit(1);

  if (!active) {
    throw new ConflictError('Nicht eingestempelt. Bitte zuerst "Kommen" buchen.');
  }

  const [openBreak] = await db
    .select()
    .from(timeEntryBreaks)
    .where(and(eq(timeEntryBreaks.timeEntryId, active.id), isNull(timeEntryBreaks.endedAt)))
    .limit(1);

  if (!openBreak) {
    throw new ConflictError('Es läuft aktuell keine Pause.');
  }

  await db
    .update(timeEntryBreaks)
    .set({
      endedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(timeEntryBreaks.id, openBreak.id));

  return getActiveEntry(userId);
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
