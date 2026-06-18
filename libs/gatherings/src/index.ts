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
  /** EVENT-002: rule-based personalised invitation reason. */
  whyInvited: string;
  createdAt: string;
}

/** EVENT-006: a scheduled milestone in the user's community calendar. */
export interface CalendarMilestoneDto {
  /** Category of the milestone */
  type: 'INTRO_DROP' | 'PROMPT_OPENS' | 'PROMPT_CLOSES' | 'CHECK_IN' | 'EVENT';
  title: string;
  scheduledAt: string; // ISO datetime
  /** Set only when type === 'EVENT' */
  eventId?: string;
}

export interface EventAttendeeDto {
  userId: string;
  name: string;
  currentCity: string;
  currentCountry: string;
  rsvpStatus: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * EVENT-002: Pure rule-based "Why Invited" text for an event.
 * No async calls — uses data already fetched by listEvents.
 */
export function generateWhyInvited(
  event: { tag: string | null; groupId: string | null },
  userGroupIds: Set<string>,
  completionScore: number,
): string {
  // Member of the event's linked group → most personalised reason
  if (event.groupId && userGroupIds.has(event.groupId)) {
    return "You're part of this community — join your fellow members";
  }

  // Low profile completion → nudge
  if (completionScore < 50) {
    return 'Complete your profile to get personalised event recommendations';
  }

  // Tag-based reasons
  switch (event.tag) {
    case EventTag.SOCIAL:       return 'Connect with the Indian diaspora in your region';
    case EventTag.SPIRITUAL:    return 'Deepen your faith journey with like-minded community members';
    case EventTag.PROFESSIONAL: return 'Grow your career network with Indian professionals abroad';
    case EventTag.CULTURAL:     return 'Celebrate your roots with the diaspora community';
    case EventTag.ADVENTURE:    return 'Meet adventurous spirits who share your love of exploration';
    case EventTag.EDUCATIONAL:  return 'Expand your knowledge with community learning sessions';
    default:                    return 'Recommended for your diaspora community';
  }
}

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
  whyInvited: string,
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
    whyInvited,
    createdAt: row.createdAt.toISOString(),
  };
}

// ─── Service functions ────────────────────────────────────────────────────────

/** Options for listEvents — EVENT-002 */
export interface ListEventsOptions {
  tag?:      EventTag;
  limit?:    number;    // default: no limit
  upcoming?: boolean;   // when true, only startAt > now
}

/**
 * List upcoming and live events ordered by startAt ascending.
 * EVENT-002: includes whyInvited text; supports ?tag, ?limit, ?upcoming filters.
 */
export async function listEvents(
  userId: string,
  options: ListEventsOptions = {},
): Promise<EventDto[]> {
  const { tag, limit, upcoming = true } = options;

  const where = {
    status: { in: [EventStatus.UPCOMING, EventStatus.LIVE] },
    ...(upcoming ? { startAt: { gte: new Date() } } : {}),
    ...(tag ? { tag } : {}),
  };

  const [rows, rsvps, profile, groupMemberships] = await Promise.all([
    prisma.event.findMany({
      where,
      orderBy: { startAt: 'asc' },
      ...(limit ? { take: limit } : {}),
      include: { _count: { select: { rsvps: true } } },
    }),
    prisma.eventRsvp.findMany({
      where:  { userId },
      select: { eventId: true },
    }),
    // Fetch user profile for whyInvited personalisation
    prisma.profile.findUnique({
      where:  { userId },
      select: { completionScore: true },
    }),
    // Fetch user's groups for group-member whyInvited
    prisma.groupMember.findMany({
      where:  { userId, status: 'ACTIVE' },
      select: { groupId: true },
    }),
  ]);

  const rsvpdIds   = new Set(rsvps.map((r) => r.eventId));
  const userGroupIds = new Set(groupMemberships.map(m => m.groupId));
  const completionScore = profile?.completionScore ?? 0;

  return rows.map((row) => {
    const why = generateWhyInvited(row, userGroupIds, completionScore);
    return toEventDto(row, rsvpdIds.has(row.id), why);
  });
}

/**
 * Get a single event by ID.
 *
 * @throws {EventNotFoundError}
 */
export async function getEvent(eventId: string, userId: string): Promise<EventDto> {
  const [row, rsvp, profile, groupMemberships] = await Promise.all([
    prisma.event.findUnique({
      where:   { id: eventId },
      include: { _count: { select: { rsvps: true } } },
    }),
    prisma.eventRsvp.findUnique({
      where:  { userId_eventId: { userId, eventId } },
      select: { id: true },
    }),
    prisma.profile.findUnique({
      where:  { userId },
      select: { completionScore: true },
    }),
    prisma.groupMember.findMany({
      where:  { userId, status: 'ACTIVE' },
      select: { groupId: true },
    }),
  ]);

  if (!row) throw new EventNotFoundError();

  const userGroupIds    = new Set(groupMemberships.map(m => m.groupId));
  const completionScore = profile?.completionScore ?? 0;
  const why             = generateWhyInvited(row, userGroupIds, completionScore);

  return toEventDto(row, !!rsvp, why);
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

// ─── EVENT-006: Calendar milestones ──────────────────────────────────────────

/** Returns the next Sunday at 09:00 UTC on or after `now`. */
function nextSundayAt9(now: Date): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 9, 0, 0, 0));
  const dayOfWeek = d.getUTCDay(); // 0 = Sunday
  if (dayOfWeek === 0 && now.getUTCHours() < 9) return d;
  const daysUntil = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;
  d.setUTCDate(d.getUTCDate() + daysUntil);
  return d;
}

/**
 * Returns this week's community milestones in chronological order.
 * EVENT-006: intro drop Sunday, active prompt window, upcoming events (next 7 days).
 */
export async function getEventCalendar(now: Date = new Date()): Promise<CalendarMilestoneDto[]> {
  const sevenDaysAhead = new Date(now.getTime() + 7 * 24 * 3600 * 1000);

  const [activePrompts, upcomingEvents] = await Promise.all([
    prisma.weeklyPrompt.findMany({
      where: {
        OR: [
          { publishedAt: { lte: sevenDaysAhead }, expiresAt: { gte: now } },
        ],
      },
      orderBy: { publishedAt: 'asc' },
      select:  { id: true, question: true, publishedAt: true, expiresAt: true },
    }),
    prisma.event.findMany({
      where:   { startAt: { gte: now, lte: sevenDaysAhead }, status: { in: ['UPCOMING', 'LIVE'] } },
      orderBy: { startAt: 'asc' },
      select:  { id: true, title: true, startAt: true },
    }),
  ]);

  const milestones: CalendarMilestoneDto[] = [];

  // Intro drop — always next Sunday 09:00 UTC
  milestones.push({
    type:        'INTRO_DROP',
    title:       'Weekly Introduction Drop',
    scheduledAt: nextSundayAt9(now).toISOString(),
  });

  // Check-in opportunity — same as intro drop (Sunday)
  milestones.push({
    type:        'CHECK_IN',
    title:       'Sunday Check-In',
    scheduledAt: nextSundayAt9(now).toISOString(),
  });

  // Active prompt windows
  for (const p of activePrompts) {
    if (p.publishedAt >= now) {
      milestones.push({ type: 'PROMPT_OPENS', title: `Prompt opens: "${p.question.slice(0, 60)}"`, scheduledAt: p.publishedAt.toISOString() });
    }
    if (p.expiresAt >= now && p.expiresAt <= sevenDaysAhead) {
      milestones.push({ type: 'PROMPT_CLOSES', title: `Prompt closes: "${p.question.slice(0, 60)}"`, scheduledAt: p.expiresAt.toISOString() });
    }
  }

  // Upcoming community events
  for (const e of upcomingEvents) {
    milestones.push({ type: 'EVENT', title: e.title, scheduledAt: e.startAt.toISOString(), eventId: e.id });
  }

  // Sort chronologically
  return milestones.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
}

// ─── EVENT-007: Post-event co-attendance pairs ────────────────────────────────

/**
 * Returns all unique user pairs who attended an event (GOING status).
 * The pair is always returned with the lexicographically smaller UUID as userAId.
 * Used by the admin endpoint to trigger score recompute for co-attending users.
 *
 * @throws {EventNotFoundError}
 */
export async function getCoAttendancePairs(
  eventId: string,
): Promise<{ userAId: string; userBId: string }[]> {
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true } });
  if (!event) throw new EventNotFoundError();

  const rsvps = await prisma.eventRsvp.findMany({
    where:  { eventId, status: 'GOING' },
    select: { userId: true },
  });

  const userIds = rsvps.map(r => r.userId);
  const pairs: { userAId: string; userBId: string }[] = [];

  for (let i = 0; i < userIds.length; i++) {
    for (let j = i + 1; j < userIds.length; j++) {
      const [a, b] = userIds[i] < userIds[j]
        ? [userIds[i], userIds[j]]
        : [userIds[j], userIds[i]];
      pairs.push({ userAId: a, userBId: b });
    }
  }

  log.info('getCoAttendancePairs', { eventId, attendeeCount: userIds.length, pairCount: pairs.length });
  return pairs;
}

// ─── Admin service re-exports (ADMIN-008) ────────────────────────────────────

export {
  EventAdminNotFoundError,
  EventAlreadyArchivedError,
  listAdminEvents,
  getAdminEvent,
  createEvent,
  updateEvent,
  archiveEvent,
  type EventAdminDto,
  type CreateEventInput,
  type UpdateEventInput,
} from './event-admin.service.js';

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
