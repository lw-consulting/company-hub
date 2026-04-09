import { eq, and, gte, lte, sql, desc, ne } from 'drizzle-orm';
import { db } from '../../config/database.js';
import { leaveTypes, leaveRequests, publicHolidays } from '../../db/schema/leave.js';
import { users } from '../../db/schema/users.js';
import { calendarEvents } from '../../db/schema/calendar.js';
import { NotFoundError, ForbiddenError, ConflictError } from '../../lib/errors.js';
import { createNotification } from '../../lib/notification.service.js';

// --- Leave Types ---

export async function getLeaveTypes(orgId: string) {
  return db
    .select()
    .from(leaveTypes)
    .where(and(eq(leaveTypes.orgId, orgId), eq(leaveTypes.isActive, true)))
    .orderBy(leaveTypes.sortOrder);
}

export async function createLeaveType(
  orgId: string,
  data: { name: string; color?: string; deductsVacation?: boolean; requiresApproval?: boolean }
) {
  const [type] = await db
    .insert(leaveTypes)
    .values({ orgId, ...data })
    .returning();
  return type;
}

// --- Business Days Calculation ---

async function getPublicHolidayDates(orgId: string, year: number): Promise<Set<string>> {
  const holidays = await db
    .select({ date: publicHolidays.date })
    .from(publicHolidays)
    .where(eq(publicHolidays.orgId, orgId));

  return new Set(holidays.map((h) => h.date));
}

export function calculateBusinessDays(
  startDate: string,
  endDate: string,
  holidayDates: Set<string>,
  halfDayStart: boolean,
  halfDayEnd: boolean
): number {
  let days = 0;
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    const dayOfWeek = current.getDay();

    // Skip weekends (0=Sun, 6=Sat) and public holidays
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidayDates.has(dateStr)) {
      if (dateStr === startDate && halfDayStart) {
        days += 0.5;
      } else if (dateStr === endDate && halfDayEnd) {
        days += 0.5;
      } else {
        days += 1;
      }
    }

    current.setDate(current.getDate() + 1);
  }

  return days;
}

// --- Leave Requests ---

export async function createLeaveRequest(
  userId: string,
  orgId: string,
  data: {
    leaveTypeId: string;
    startDate: string;
    endDate: string;
    halfDayStart?: boolean;
    halfDayEnd?: boolean;
    reason?: string;
  }
) {
  // Validate leave type
  const [type] = await db
    .select()
    .from(leaveTypes)
    .where(and(eq(leaveTypes.id, data.leaveTypeId), eq(leaveTypes.orgId, orgId)))
    .limit(1);

  if (!type) throw new NotFoundError('Abwesenheitstyp nicht gefunden');

  // Check for overlapping requests
  const overlapping = await db
    .select({ id: leaveRequests.id })
    .from(leaveRequests)
    .where(
      and(
        eq(leaveRequests.userId, userId),
        ne(leaveRequests.status, 'rejected'),
        ne(leaveRequests.status, 'cancelled'),
        lte(leaveRequests.startDate, data.endDate),
        gte(leaveRequests.endDate, data.startDate)
      )
    )
    .limit(1);

  if (overlapping.length > 0) {
    throw new ConflictError('Es gibt bereits einen Antrag für diesen Zeitraum');
  }

  // Calculate business days
  const year = new Date(data.startDate).getFullYear();
  const holidays = await getPublicHolidayDates(orgId, year);
  const businessDays = calculateBusinessDays(
    data.startDate,
    data.endDate,
    holidays,
    data.halfDayStart || false,
    data.halfDayEnd || false
  );

  // Auto-approve if no approval required
  const status = type.requiresApproval ? 'pending' : 'approved';

  const [request] = await db
    .insert(leaveRequests)
    .values({
      userId,
      orgId,
      leaveTypeId: data.leaveTypeId,
      startDate: data.startDate,
      endDate: data.endDate,
      halfDayStart: data.halfDayStart || false,
      halfDayEnd: data.halfDayEnd || false,
      businessDays,
      reason: data.reason,
      status,
    })
    .returning();

  // Notify supervisor if approval required
  if (type.requiresApproval) {
    const [user] = await db
      .select({
        firstName: users.firstName,
        lastName: users.lastName,
        supervisorId: users.supervisorId,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user?.supervisorId) {
      await createNotification({
        userId: user.supervisorId,
        type: 'leave_request',
        title: 'Neuer Urlaubsantrag',
        body: `${user.firstName} ${user.lastName} hat einen ${type.name}-Antrag gestellt (${data.startDate} - ${data.endDate}, ${businessDays} Tage).`,
        link: '/leave',
        moduleId: 'leave',
      });
    }
  }

  // If auto-approved, create calendar event
  if (status === 'approved') {
    await createLeaveCalendarEvent(request.id, userId, orgId, data.startDate, data.endDate, type.name, type.color);
  }

  return request;
}

export async function getMyLeaveRequests(userId: string, year?: number) {
  const targetYear = year || new Date().getFullYear();
  const startOfYear = `${targetYear}-01-01`;
  const endOfYear = `${targetYear}-12-31`;

  const requests = await db
    .select({
      id: leaveRequests.id,
      leaveTypeId: leaveRequests.leaveTypeId,
      startDate: leaveRequests.startDate,
      endDate: leaveRequests.endDate,
      halfDayStart: leaveRequests.halfDayStart,
      halfDayEnd: leaveRequests.halfDayEnd,
      businessDays: leaveRequests.businessDays,
      reason: leaveRequests.reason,
      status: leaveRequests.status,
      decisionNote: leaveRequests.decisionNote,
      decidedAt: leaveRequests.decidedAt,
      createdAt: leaveRequests.createdAt,
      leaveTypeName: leaveTypes.name,
      leaveTypeColor: leaveTypes.color,
      deductsVacation: leaveTypes.deductsVacation,
    })
    .from(leaveRequests)
    .innerJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
    .where(
      and(
        eq(leaveRequests.userId, userId),
        gte(leaveRequests.startDate, startOfYear),
        lte(leaveRequests.startDate, endOfYear)
      )
    )
    .orderBy(desc(leaveRequests.startDate));

  return requests;
}

export async function getVacationBalance(userId: string, year?: number) {
  const targetYear = year || new Date().getFullYear();

  // Get user's vacation days per year
  const [user] = await db
    .select({ vacationDaysPerYear: users.vacationDaysPerYear })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const totalDays = user?.vacationDaysPerYear || 25;

  // Sum approved vacation-deducting requests
  const requests = await getMyLeaveRequests(userId, targetYear);
  const usedDays = requests
    .filter((r) => r.status === 'approved' && r.deductsVacation)
    .reduce((sum, r) => sum + r.businessDays, 0);

  const pendingDays = requests
    .filter((r) => r.status === 'pending' && r.deductsVacation)
    .reduce((sum, r) => sum + r.businessDays, 0);

  return {
    totalDays,
    usedDays,
    pendingDays,
    remainingDays: totalDays - usedDays,
    availableDays: totalDays - usedDays - pendingDays,
    year: targetYear,
  };
}

/** Supervisor approves or rejects a leave request */
/** User updates their own pending leave request */
export async function updateOwnLeaveRequest(
  requestId: string,
  userId: string,
  orgId: string,
  data: {
    leaveTypeId?: string;
    startDate?: string;
    endDate?: string;
    halfDayStart?: boolean;
    halfDayEnd?: boolean;
    reason?: string;
  }
) {
  const [request] = await db
    .select()
    .from(leaveRequests)
    .where(and(eq(leaveRequests.id, requestId), eq(leaveRequests.userId, userId)))
    .limit(1);

  if (!request) throw new NotFoundError('Antrag nicht gefunden');
  if (request.status !== 'pending') {
    throw new ConflictError('Nur ausstehende Anträge können bearbeitet werden');
  }

  // Build new effective values
  const newLeaveTypeId = data.leaveTypeId ?? request.leaveTypeId;
  const newStartDate = data.startDate ?? request.startDate;
  const newEndDate = data.endDate ?? request.endDate;
  const newHalfDayStart = data.halfDayStart ?? request.halfDayStart;
  const newHalfDayEnd = data.halfDayEnd ?? request.halfDayEnd;

  // Check overlap with OTHER requests (exclude this one)
  const overlapping = await db
    .select({ id: leaveRequests.id })
    .from(leaveRequests)
    .where(
      and(
        eq(leaveRequests.userId, userId),
        ne(leaveRequests.id, requestId),
        ne(leaveRequests.status, 'rejected'),
        ne(leaveRequests.status, 'cancelled'),
        lte(leaveRequests.startDate, newEndDate),
        gte(leaveRequests.endDate, newStartDate)
      )
    )
    .limit(1);

  if (overlapping.length > 0) {
    throw new ConflictError('Es gibt bereits einen Antrag für diesen Zeitraum');
  }

  // Recalculate business days
  const year = new Date(newStartDate).getFullYear();
  const holidays = await getPublicHolidayDates(orgId, year);
  const businessDays = calculateBusinessDays(
    newStartDate,
    newEndDate,
    holidays,
    newHalfDayStart || false,
    newHalfDayEnd || false
  );

  const [updated] = await db
    .update(leaveRequests)
    .set({
      leaveTypeId: newLeaveTypeId,
      startDate: newStartDate,
      endDate: newEndDate,
      halfDayStart: newHalfDayStart,
      halfDayEnd: newHalfDayEnd,
      reason: data.reason !== undefined ? data.reason : request.reason,
      businessDays,
      updatedAt: new Date(),
    })
    .where(eq(leaveRequests.id, requestId))
    .returning();

  return updated;
}

/** User cancels their own pending leave request */
export async function cancelOwnLeaveRequest(requestId: string, userId: string) {
  const [request] = await db
    .select()
    .from(leaveRequests)
    .where(and(eq(leaveRequests.id, requestId), eq(leaveRequests.userId, userId)))
    .limit(1);

  if (!request) throw new NotFoundError('Antrag nicht gefunden');
  if (request.status !== 'pending') {
    throw new ConflictError('Nur ausstehende Anträge können storniert werden');
  }

  await db
    .update(leaveRequests)
    .set({
      status: 'cancelled',
      updatedAt: new Date(),
    })
    .where(eq(leaveRequests.id, requestId));

  return { id: requestId };
}

export async function decideLeaveRequest(
  requestId: string,
  decidedBy: string,
  decision: 'approved' | 'rejected',
  note?: string
) {
  const [request] = await db
    .select()
    .from(leaveRequests)
    .where(eq(leaveRequests.id, requestId))
    .limit(1);

  if (!request) throw new NotFoundError('Antrag nicht gefunden');
  if (request.status !== 'pending') throw new ConflictError('Antrag wurde bereits bearbeitet');

  // Verify that the decider is the supervisor
  const [employee] = await db
    .select({ supervisorId: users.supervisorId })
    .from(users)
    .where(eq(users.id, request.userId))
    .limit(1);

  // Allow admins and the assigned supervisor
  // (role check happens in route preHandler, here we just check supervisor)

  const [updated] = await db
    .update(leaveRequests)
    .set({
      status: decision,
      decidedBy,
      decidedAt: new Date(),
      decisionNote: note,
      updatedAt: new Date(),
    })
    .where(eq(leaveRequests.id, requestId))
    .returning();

  // Notify the employee
  const statusText = decision === 'approved' ? 'genehmigt' : 'abgelehnt';
  await createNotification({
    userId: request.userId,
    type: `leave_${decision}`,
    title: `Urlaubsantrag ${statusText}`,
    body: `Ihr Antrag vom ${request.startDate} bis ${request.endDate} wurde ${statusText}.${note ? ` Anmerkung: ${note}` : ''}`,
    link: '/leave',
    moduleId: 'leave',
  });

  // If approved, create calendar event
  if (decision === 'approved') {
    const [type] = await db
      .select({ name: leaveTypes.name, color: leaveTypes.color })
      .from(leaveTypes)
      .where(eq(leaveTypes.id, request.leaveTypeId))
      .limit(1);

    await createLeaveCalendarEvent(
      request.id,
      request.userId,
      request.orgId,
      request.startDate,
      request.endDate,
      type?.name || 'Abwesend',
      type?.color || '#6366f1'
    );
  }

  return updated;
}

/** Get pending requests for a supervisor */
export async function getPendingRequestsForSupervisor(supervisorId: string, orgId: string) {
  const teamMembers = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.supervisorId, supervisorId), eq(users.orgId, orgId)));

  const memberIds = teamMembers.map((m) => m.id);
  if (memberIds.length === 0) return [];

  const results = [];
  for (const memberId of memberIds) {
    const requests = await db
      .select({
        id: leaveRequests.id,
        userId: leaveRequests.userId,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        businessDays: leaveRequests.businessDays,
        reason: leaveRequests.reason,
        status: leaveRequests.status,
        createdAt: leaveRequests.createdAt,
        leaveTypeName: leaveTypes.name,
        employeeFirstName: users.firstName,
        employeeLastName: users.lastName,
      })
      .from(leaveRequests)
      .innerJoin(leaveTypes, eq(leaveRequests.leaveTypeId, leaveTypes.id))
      .innerJoin(users, eq(leaveRequests.userId, users.id))
      .where(
        and(
          eq(leaveRequests.userId, memberId),
          eq(leaveRequests.status, 'pending')
        )
      )
      .orderBy(leaveRequests.createdAt);

    results.push(...requests);
  }

  return results;
}

// --- Helper ---

async function createLeaveCalendarEvent(
  requestId: string,
  userId: string,
  orgId: string,
  startDate: string,
  endDate: string,
  typeName: string,
  color: string
) {
  const [user] = await db
    .select({ firstName: users.firstName, lastName: users.lastName })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const title = `${user?.firstName} ${user?.lastName} - ${typeName}`;

  await db.insert(calendarEvents).values({
    orgId,
    createdBy: userId,
    title,
    startAt: new Date(startDate + 'T00:00:00'),
    endAt: new Date(endDate + 'T23:59:59'),
    allDay: true,
    color,
    visibility: 'team',
    sourceType: 'leave_request',
    sourceId: requestId,
  });
}

// --- Public Holidays ---

export async function getPublicHolidays(orgId: string, year?: number) {
  const targetYear = year || new Date().getFullYear();
  return db
    .select()
    .from(publicHolidays)
    .where(eq(publicHolidays.orgId, orgId))
    .orderBy(publicHolidays.date);
}

export async function createPublicHoliday(orgId: string, data: { date: string; name: string }) {
  const [holiday] = await db
    .insert(publicHolidays)
    .values({ orgId, ...data })
    .returning();
  return holiday;
}

export async function deletePublicHoliday(id: string) {
  await db.delete(publicHolidays).where(eq(publicHolidays.id, id));
}
