import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';
import { EventStatus, EventTag } from '@abroad-matrimony/shared';

const log = createChildLogger({ module: 'gatherings' });

// ─── Custom errors ────────────────────────────────────────────────────────────

export class EventNotFoundError extends Error {
  constructor() {
    super('EVENT_NOT_FOUND');
    this.name = 'EventNotFoundError';
  }
}

export class AlreadyRsvpdError extends Error {
  constructor() {
    super('ALREADY_RSVPD');
    this.name = 'AlreadyRsvpdError';
  }
}

export class NotRsvpdError extends Error {
  constructor() {
    super('NOT_RSVPD');
    this.name = 'NotRsvpdError';
  }
}

export class EventFullError extends Error {
  constructor() {
    super('EVENT_FULL');
    this.name = 'EventFullError';
  }
}

export class EventNotUpcomingError extends Error {
  constructor() {
    super('EVENT_NOT_UPCOMING');
    this.name = 'EventNotUpcomingError';
  }
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface EventDto {
  id: string;
  groupId: string | null;
  title: string;
  description: string | null;
  status: string;
  tag: string | null;
  creditCost: number;
  startAt: string;
  endAt: string | null;
  location: string | null;
  onlineUrl: string | null;
  capacity: number | null;
  rsvpCount: number;
  isRsvpd: boolean;
  createdAt: string;
}

export interface EventAttendeeDto {
  userId: string;
  name: string;
  currentCity: string;
  currentCountry: string;
  rsvpStatus: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toEventDto(
  row: {
    id: string;
    groupId: string | null;
    title: string;
    description: string | null;
    status: string;
    tag: string | null;
    creditCost: number;
    startAt: Date;
    endAt: Date | null;
    location: string | null;
    onlineUrl: string | null;
    capacity: number | null;
    createdAt: Date;
    _count?: { rsvps: number };
  },
  isRsvpd: boolean,
): EventDto {
  return {
    id: row.id,
    groupId: row.groupId,
    title: row.title,
    description: row.description,
    status: row.status,
    tag: row.tag,
    creditCost: row.creditCost,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt?.toISOString() ?? null,
    location: row.location,
    onlineUrl: row.onlineUrl,
    capacity: row.capacity,
    rsvpCount: row._count?.rsvps ?? 0,
    isRsvpd,
    createdAt: row.createdAt.toISOString(),
  };
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * List upcoming and live events ordered by startAt ascending.
 * Optionally filter by tag.
 */
export async function listEvents(
  userId: string,
  tag?: EventTag,
): Promise<EventDto[]> {
  const where = {
    status: { in: [EventStatus.UPCOMING, EventStatus.LIVE] },
    startAt: { gte: new Date() },
    ...(tag ? { tag } : {}),
  };

  const [rows, rsvps] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy: { startAt: 'asc' },
      include: { _count: { select: { rsvps: true } } },
    }),
    prisma.eventRsvp.findMany({
      where: { userId },
      select: { eventId: true },
    }),
  ]);

  const rsvpdIds = new Set(rsvps.map((r) => r.eventId));

  return rows.map((row) => toEventDto(row, rsvpdIds.has(row.id)));
}

/**
 * Get a single event by ID.
 *
 * @throws {EventNotFoundError}
 */
export async function getEvent(eventId: string, userId: string): Promise<EventDto> {
  const row = await prisma.event.findUnique({
    where: { id: eventId },
    include: { _count: { select: { rsvps: true } } },
  });

  if (!row) throw new EventNotFoundError();

  const rsvp = await prisma.eventRsvp.findUnique({
    where: { userId_eventId: { userId, eventId } },
    select: { id: true },
  });

  return toEventDto(row, !!rsvp);
}

/**
 * RSVP to an event.
 *
 * @throws {EventNotFoundError}
 * @throws {AlreadyRsvpdError}
 * @throws {EventFullError}
 * @throws {EventNotUpcomingError}
 */
export async function rsvpToEvent(eventId: string, userId: string): Promise<void> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { _count: { select: { rsvps: true } } },
  });

  if (!event) throw new EventNotFoundError();

  if (!(event.status === EventStatus.UPCOMING || event.status === EventStatus.LIVE)) {
    throw new EventNotUpcomingError();
  }

  const existing = await prisma.eventRsvp.findUnique({
    where: { userId_eventId: { userId, eventId } },
    select: { id: true },
  });

  if (existing) throw new AlreadyRsvpdError();

  if (event.capacity !== null && event._count.rsvps >= event.capacity) {
    throw new EventFullError();
  }

  await prisma.eventRsvp.create({
    data: { userId, eventId, status: 'GOING' },
  });

  log.info('rsvpToEvent — RSVP created', { eventId, userId });
}

/**
 * Cancel RSVP to an event.
 *
 * @throws {EventNotFoundError}
 * @throws {NotRsvpdError}
 */
export async function cancelRsvp(eventId: string, userId: string): Promise<void> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });

  if (!event) throw new EventNotFoundError();

  const rsvp = await prisma.eventRsvp.findUnique({
    where: { userId_eventId: { userId, eventId } },
    select: { id: true },
  });

  if (!rsvp) throw new NotRsvpdError();

  await prisma.eventRsvp.delete({
    where: { userId_eventId: { userId, eventId } },
  });

  log.info('cancelRsvp — RSVP cancelled', { eventId, userId });
}

/**
 * List attendees (GOING) for an event.
 *
 * @throws {EventNotFoundError}
 */
export async function getEventAttendees(
  eventId: string,
): Promise<EventAttendeeDto[]> {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });

  if (!event) throw new EventNotFoundError();

  const rsvps = await prisma.eventRsvp.findMany({
    where: { eventId, status: 'GOING' },
    orderBy: { createdAt: 'asc' },
    include: {
      user: { include: { profile: true } },
    },
  });

  return rsvps
    .filter((r) => r.user.profile !== null)
    .map((r) => ({
      userId: r.userId,
      name: r.user.profile!.name,
      currentCity: r.user.profile!.currentCity,
      currentCountry: r.user.profile!.currentCountry,
      rsvpStatus: r.status,
    }));
}
