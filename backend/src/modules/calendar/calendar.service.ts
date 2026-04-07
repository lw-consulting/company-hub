import { eq, and, gte, lte, or, desc, sql } from 'drizzle-orm';
import { db } from '../../config/database.js';
import { calendarEvents, calendarEventAttendees } from '../../db/schema/calendar.js';
import { users } from '../../db/schema/users.js';
import { NotFoundError } from '../../lib/errors.js';

interface CreateEventInput {
  title: string;
  description?: string;
  location?: string;
  startAt: string;
  endAt: string;
  allDay?: boolean;
  color?: string;
  visibility?: 'private' | 'team' | 'org';
  attendeeIds?: string[];
}

export async function createEvent(userId: string, orgId: string, data: CreateEventInput) {
  const [event] = await db
    .insert(calendarEvents)
    .values({
      orgId,
      createdBy: userId,
      title: data.title,
      description: data.description,
      location: data.location,
      startAt: new Date(data.startAt),
      endAt: new Date(data.endAt),
      allDay: data.allDay || false,
      color: data.color,
      visibility: data.visibility || 'private',
      sourceType: 'manual',
    })
    .returning();

  // Add attendees
  if (data.attendeeIds?.length) {
    const attendees = data.attendeeIds.map((uid) => ({
      eventId: event.id,
      userId: uid,
    }));
    await db.insert(calendarEventAttendees).values(attendees);
  }

  return event;
}

export async function getEvents(
  userId: string,
  orgId: string,
  startDate: string,
  endDate: string
) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Get events that are:
  // 1. Created by me (any visibility)
  // 2. Visibility=team or org (from same org)
  // 3. I'm an attendee
  const myEvents = await db
    .select({
      id: calendarEvents.id,
      title: calendarEvents.title,
      description: calendarEvents.description,
      location: calendarEvents.location,
      startAt: calendarEvents.startAt,
      endAt: calendarEvents.endAt,
      allDay: calendarEvents.allDay,
      color: calendarEvents.color,
      visibility: calendarEvents.visibility,
      sourceType: calendarEvents.sourceType,
      createdBy: calendarEvents.createdBy,
      creatorFirstName: users.firstName,
      creatorLastName: users.lastName,
    })
    .from(calendarEvents)
    .leftJoin(users, eq(calendarEvents.createdBy, users.id))
    .where(
      and(
        eq(calendarEvents.orgId, orgId),
        lte(calendarEvents.startAt, end),
        gte(calendarEvents.endAt, start),
        or(
          eq(calendarEvents.createdBy, userId),
          eq(calendarEvents.visibility, 'team'),
          eq(calendarEvents.visibility, 'org')
        )
      )
    )
    .orderBy(calendarEvents.startAt);

  return myEvents;
}

export async function getEventById(eventId: string) {
  const [event] = await db
    .select()
    .from(calendarEvents)
    .where(eq(calendarEvents.id, eventId))
    .limit(1);

  if (!event) throw new NotFoundError('Termin nicht gefunden');

  // Get attendees
  const attendees = await db
    .select({
      id: calendarEventAttendees.id,
      userId: calendarEventAttendees.userId,
      status: calendarEventAttendees.status,
      firstName: users.firstName,
      lastName: users.lastName,
    })
    .from(calendarEventAttendees)
    .leftJoin(users, eq(calendarEventAttendees.userId, users.id))
    .where(eq(calendarEventAttendees.eventId, eventId));

  return { ...event, attendees };
}

export async function updateEvent(
  eventId: string,
  userId: string,
  data: Partial<CreateEventInput>
) {
  const updateData: Record<string, any> = { updatedAt: new Date() };

  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.location !== undefined) updateData.location = data.location;
  if (data.startAt) updateData.startAt = new Date(data.startAt);
  if (data.endAt) updateData.endAt = new Date(data.endAt);
  if (data.allDay !== undefined) updateData.allDay = data.allDay;
  if (data.color !== undefined) updateData.color = data.color;
  if (data.visibility !== undefined) updateData.visibility = data.visibility;

  const [event] = await db
    .update(calendarEvents)
    .set(updateData)
    .where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.createdBy, userId)))
    .returning();

  if (!event) throw new NotFoundError('Termin nicht gefunden oder keine Berechtigung');
  return event;
}

export async function deleteEvent(eventId: string, userId: string) {
  const [deleted] = await db
    .delete(calendarEvents)
    .where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.createdBy, userId)))
    .returning({ id: calendarEvents.id });

  if (!deleted) throw new NotFoundError('Termin nicht gefunden oder keine Berechtigung');
}

/** Get team absences for shared calendar view */
export async function getTeamAbsences(orgId: string, startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  return db
    .select({
      id: calendarEvents.id,
      title: calendarEvents.title,
      startAt: calendarEvents.startAt,
      endAt: calendarEvents.endAt,
      allDay: calendarEvents.allDay,
      color: calendarEvents.color,
      sourceType: calendarEvents.sourceType,
      creatorFirstName: users.firstName,
      creatorLastName: users.lastName,
    })
    .from(calendarEvents)
    .leftJoin(users, eq(calendarEvents.createdBy, users.id))
    .where(
      and(
        eq(calendarEvents.orgId, orgId),
        eq(calendarEvents.sourceType, 'leave_request'),
        lte(calendarEvents.startAt, end),
        gte(calendarEvents.endAt, start)
      )
    )
    .orderBy(calendarEvents.startAt);
}
