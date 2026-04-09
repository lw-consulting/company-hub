import { eq, and, gte, lte, isNull, desc, inArray, asc, ne } from 'drizzle-orm';
import { db } from '../../config/database.js';
import { timeEntries, timeEntryBreaks, timeEntryChangeRequests } from '../../db/schema/time-tracking.js';
import { organizations } from '../../db/schema/organizations.js';
import { users } from '../../db/schema/users.js';
import { notifications } from '../../db/schema/notifications.js';
import { AppError, ConflictError, ForbiddenError, NotFoundError } from '../../lib/errors.js';
import { calculateActualBreakMinutes, calculateBookedBreakMinutes } from './time-tracking.logic.js';

interface BreakInput {
  startedAt: string;
  endedAt: string;
}

interface TimeEntryUpdateInput {
  clockIn?: string;
  clockOut?: string;
  breakMinutes?: number;
  notes?: string | null;
  breaks?: BreakInput[];
}

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

async function replaceEntryBreaks(
  entry: typeof timeEntries.$inferSelect,
  breaks: BreakInput[],
) {
  await db.delete(timeEntryBreaks).where(eq(timeEntryBreaks.timeEntryId, entry.id));

  if (breaks.length === 0) {
    return;
  }

  await db.insert(timeEntryBreaks).values(
    breaks.map((entryBreak) => ({
      timeEntryId: entry.id,
      userId: entry.userId,
      orgId: entry.orgId,
      startedAt: new Date(entryBreak.startedAt),
      endedAt: new Date(entryBreak.endedAt),
    })),
  );
}

async function applyEntryUpdate(
  entry: typeof timeEntries.$inferSelect,
  data: TimeEntryUpdateInput,
  options: {
    correctedBy?: string;
    userEdited?: boolean;
  } = {},
) {
  const now = new Date();
  const nextClockIn = data.clockIn ? new Date(data.clockIn) : entry.clockIn;
  const nextClockOut = data.clockOut ? new Date(data.clockOut) : entry.clockOut;

  const updateData: Record<string, any> = {
    updatedAt: now,
  };

  if (options.correctedBy) {
    updateData.correctedBy = options.correctedBy;
    updateData.correctionNote = 'Korrektur durch Vorgesetzten';
  }

  if (options.userEdited) {
    updateData.userEdited = true;
    updateData.userEditedAt = now;
  }

  if (data.clockIn) updateData.clockIn = nextClockIn;
  if (data.clockOut) updateData.clockOut = nextClockOut;
  if (data.notes !== undefined) updateData.notes = data.notes;

  let actualBreakMinutes = entry.breakMinutes;
  let bookedBreakMinutes = data.breakMinutes ?? entry.breakMinutes;
  let autoBreakApplied = entry.autoBreakApplied;

  if (data.breaks) {
    const sorted = [...data.breaks].sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
    for (const entryBreak of sorted) {
      const startedAt = new Date(entryBreak.startedAt);
      const endedAt = new Date(entryBreak.endedAt);
      if (!(startedAt < endedAt)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Pausenende muss nach dem Pausenstart liegen.');
      }
      if (startedAt < nextClockIn || (nextClockOut && endedAt > nextClockOut)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Pausen müssen innerhalb der Arbeitszeit liegen.');
      }
    }

    for (let i = 1; i < sorted.length; i += 1) {
      if (new Date(sorted[i - 1].endedAt).getTime() > new Date(sorted[i].startedAt).getTime()) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Pausen dürfen sich nicht überschneiden.');
      }
    }

    await replaceEntryBreaks(entry, sorted);
    actualBreakMinutes = calculateActualBreakMinutes(
      sorted.map((item) => ({ startedAt: new Date(item.startedAt), endedAt: new Date(item.endedAt) })),
      nextClockOut ?? now,
    );

    if (nextClockOut) {
      const durationMinutes = Math.round((nextClockOut.getTime() - nextClockIn.getTime()) / 60000);
      bookedBreakMinutes = calculateBookedBreakMinutes(durationMinutes, actualBreakMinutes, await getBreakPolicy(entry.orgId));
      autoBreakApplied = bookedBreakMinutes > actualBreakMinutes;
    } else {
      bookedBreakMinutes = actualBreakMinutes;
      autoBreakApplied = false;
    }
  } else if (data.breakMinutes !== undefined) {
    bookedBreakMinutes = data.breakMinutes;
    autoBreakApplied = false;
  }

  updateData.breakMinutes = bookedBreakMinutes;
  updateData.autoBreakApplied = autoBreakApplied;

  const [updated] = await db
    .update(timeEntries)
    .set(updateData)
    .where(eq(timeEntries.id, entry.id))
    .returning();

  if (!updated) {
    throw new NotFoundError('Zeiteintrag nicht gefunden');
  }

  return decorateEntry(updated, nextClockOut ?? now);
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
  data: TimeEntryUpdateInput,
  correctedBy: string
) {
  const [entry] = await db.select().from(timeEntries).where(eq(timeEntries.id, entryId)).limit(1);
  if (!entry) throw new NotFoundError('Zeiteintrag nicht gefunden');
  return applyEntryUpdate(entry, data, { correctedBy });
}

/** User edits their own time entry (marked as userEdited) */
export async function updateOwnEntry(
  entryId: string,
  userId: string,
  data: TimeEntryUpdateInput
) {
  const [existing] = await db
    .select()
    .from(timeEntries)
    .where(and(eq(timeEntries.id, entryId), eq(timeEntries.userId, userId)))
    .limit(1);

  if (!existing) throw new NotFoundError('Zeiteintrag nicht gefunden');

  const [user] = await db
    .select({
      supervisorId: users.supervisorId,
      timeEditsRequireApproval: users.timeEditsRequireApproval,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    throw new NotFoundError('Benutzer nicht gefunden');
  }

  if (user.timeEditsRequireApproval && user.supervisorId) {
    const [existingRequest] = await db
      .select({ id: timeEntryChangeRequests.id })
      .from(timeEntryChangeRequests)
      .where(and(
        eq(timeEntryChangeRequests.timeEntryId, entryId),
        eq(timeEntryChangeRequests.userId, userId),
        eq(timeEntryChangeRequests.status, 'pending'),
      ))
      .limit(1);

    if (existingRequest) {
      throw new ConflictError('Für diesen Zeiteintrag gibt es bereits einen offenen Änderungsantrag.');
    }

    const requestedChange = {
      clockIn: data.clockIn,
      clockOut: data.clockOut,
      breakMinutes: data.breakMinutes,
      notes: data.notes,
      breaks: data.breaks,
    };

    const [request] = await db
      .insert(timeEntryChangeRequests)
      .values({
        timeEntryId: entryId,
        userId,
        orgId: existing.orgId,
        supervisorId: user.supervisorId,
        requestedChange,
      })
      .returning();

    await db.insert(notifications).values({
      userId: user.supervisorId,
      type: 'time_entry_change_request',
      title: 'Zeiteintrag zur Freigabe',
      body: `${user.firstName} ${user.lastName} hat eine Änderung an einem Zeiteintrag zur Freigabe eingereicht.`,
      link: '/time-tracking',
      moduleId: 'time-tracking',
    });

    return {
      approvalRequired: true,
      requestId: request.id,
    };
  }

  const entry = await applyEntryUpdate(existing, data, { userEdited: true });
  return {
    approvalRequired: false,
    entry,
  };
}

export async function getPendingChangeRequests(supervisorId: string, orgId: string) {
  const requests = await db
    .select({
      id: timeEntryChangeRequests.id,
      status: timeEntryChangeRequests.status,
      requestedChange: timeEntryChangeRequests.requestedChange,
      decisionNote: timeEntryChangeRequests.decisionNote,
      createdAt: timeEntryChangeRequests.createdAt,
      entryId: timeEntries.id,
      clockIn: timeEntries.clockIn,
      clockOut: timeEntries.clockOut,
      breakMinutes: timeEntries.breakMinutes,
      notes: timeEntries.notes,
      userId: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(timeEntryChangeRequests)
    .innerJoin(timeEntries, eq(timeEntryChangeRequests.timeEntryId, timeEntries.id))
    .innerJoin(users, eq(timeEntryChangeRequests.userId, users.id))
    .where(and(
      eq(timeEntryChangeRequests.orgId, orgId),
      eq(timeEntryChangeRequests.supervisorId, supervisorId),
      eq(timeEntryChangeRequests.status, 'pending'),
    ))
    .orderBy(desc(timeEntryChangeRequests.createdAt));

  return requests;
}

export async function decideChangeRequest(
  requestId: string,
  supervisorId: string,
  decision: 'approved' | 'rejected',
  note?: string,
) {
  const [request] = await db
    .select()
    .from(timeEntryChangeRequests)
    .where(eq(timeEntryChangeRequests.id, requestId))
    .limit(1);

  if (!request) {
    throw new NotFoundError('Änderungsantrag nicht gefunden');
  }
  if (request.supervisorId !== supervisorId) {
    throw new ForbiddenError('Nicht berechtigt');
  }
  if (request.status !== 'pending') {
    throw new ConflictError('Dieser Änderungsantrag wurde bereits bearbeitet.');
  }

  let updatedEntry: Awaited<ReturnType<typeof decorateEntry>> | null = null;
  if (decision === 'approved') {
    const [entry] = await db.select().from(timeEntries).where(eq(timeEntries.id, request.timeEntryId)).limit(1);
    if (!entry) {
      throw new NotFoundError('Zeiteintrag nicht gefunden');
    }
    updatedEntry = await applyEntryUpdate(entry, request.requestedChange, { correctedBy: supervisorId });
  }

  await db
    .update(timeEntryChangeRequests)
    .set({
      status: decision,
      decisionNote: note,
      decidedAt: new Date(),
      decidedBy: supervisorId,
      updatedAt: new Date(),
    })
    .where(eq(timeEntryChangeRequests.id, requestId));

  await db.insert(notifications).values({
    userId: request.userId,
    type: 'time_entry_change_request_decision',
    title: decision === 'approved' ? 'Zeitänderung genehmigt' : 'Zeitänderung abgelehnt',
    body: decision === 'approved'
      ? `Deine Änderung eines Zeiteintrags wurde genehmigt.${note ? ` Hinweis: ${note}` : ''}`
      : `Deine Änderung eines Zeiteintrags wurde abgelehnt.${note ? ` Hinweis: ${note}` : ''}`,
    link: '/time-tracking',
    moduleId: 'time-tracking',
  });

  return {
    status: decision,
    updatedEntry,
  };
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
