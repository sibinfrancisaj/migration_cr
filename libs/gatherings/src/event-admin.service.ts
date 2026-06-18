/**
 * ADMIN-008 — Event admin service.
 * Create, update, and archive events. Admin-level access — no RSVP constraints.
 */
import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';
import { auditLog } from '@abroad-matrimony/auth';
import { EventStatus } from '@abroad-matrimony/shared';

const log = createChildLogger({ module: 'gatherings:admin' });

// ─── Custom errors ────────────────────────────────────────────────────────────

export class EventAdminNotFoundError extends Error {
  constructor() {
    super('EVENT_NOT_FOUND');
    this.name = 'EventAdminNotFoundError';
  }
}

export class EventAlreadyArchivedError extends Error {
  constructor() {
    super('EVENT_ALREADY_ARCHIVED');
    this.name = 'EventAlreadyArchivedError';
  }
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface EventAdminDto {
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
  createdAt: string;
}

export interface CreateEventInput {
  groupId?: string;
  title: string;
  description?: string;
  tag?: string;
  creditCost?: number;
  startAt: string;
  endAt?: string;
  location?: string;
  onlineUrl?: string;
  capacity?: number;
}

export interface UpdateEventInput {
  title?: string;
  description?: string;
  tag?: string;
  creditCost?: number;
  startAt?: string;
  endAt?: string;
  location?: string;
  onlineUrl?: string;
  capacity?: number;
  status?: string;
}

// ─── listAdminEvents ──────────────────────────────────────────────────────────

export async function listAdminEvents(params: {
  status?: string;
  limit?: number;
  cursor?: string;
}): Promise<{ items: EventAdminDto[]; hasMore: boolean; nextCursor: string | null }> {
  const limit = Math.min(params.limit ?? 20, 100);

  const rows = await prisma.event.findMany({
    where: {
      ...(params.status ? { status: params.status as EventStatus } : {}),
      ...(params.cursor ? { id: { gt: params.cursor } } : {}),
    },
    orderBy: { startAt: 'asc' },
    take: limit + 1,
    include: { _count: { select: { rsvps: true } } },
  });

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);

  return {
    items: page.map(toEventAdminDto),
    hasMore,
    nextCursor: hasMore ? page[page.length - 1]!.id : null,
  };
}

// ─── getAdminEvent ────────────────────────────────────────────────────────────

export async function getAdminEvent(eventId: string): Promise<EventAdminDto> {
  const row = await prisma.event.findUnique({
    where: { id: eventId },
    include: { _count: { select: { rsvps: true } } },
  });
  if (!row) throw new EventAdminNotFoundError();
  return toEventAdminDto(row);
}

// ─── createEvent ──────────────────────────────────────────────────────────────

export async function createEvent(
  input: CreateEventInput,
  adminId: string,
  ipAddress: string,
): Promise<EventAdminDto> {
  const row = await prisma.event.create({
    data: {
      groupId:     input.groupId ?? null,
      title:       input.title,
      description: input.description ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tag:         (input.tag ?? null) as any,
      creditCost:  input.creditCost ?? 0,
      startAt:     new Date(input.startAt),
      endAt:       input.endAt ? new Date(input.endAt) : null,
      location:    input.location ?? null,
      onlineUrl:   input.onlineUrl ?? null,
      capacity:    input.capacity ?? null,
      status:      EventStatus.UPCOMING,
    },
    include: { _count: { select: { rsvps: true } } },
  });

  log.info('createEvent — created', { eventId: row.id, adminId });

  await auditLog({
    adminId,
    action: 'CREATE_EVENT',
    entity: 'Event',
    entityId: row.id,
    ipAddress,
    metadata: { title: input.title },
  });

  return toEventAdminDto(row);
}

// ─── updateEvent ──────────────────────────────────────────────────────────────

export async function updateEvent(
  eventId: string,
  input: UpdateEventInput,
  adminId: string,
  ipAddress: string,
): Promise<EventAdminDto> {
  const existing = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true },
  });
  if (!existing) throw new EventAdminNotFoundError();

  const row = await prisma.event.update({
    where: { id: eventId },
    data: {
      ...(input.title       !== undefined ? { title: input.title }                             : {}),
      ...(input.description !== undefined ? { description: input.description }                 : {}),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(input.tag         !== undefined ? { tag: input.tag as any }                          : {}),
      ...(input.creditCost  !== undefined ? { creditCost: input.creditCost }                   : {}),
      ...(input.startAt     !== undefined ? { startAt: new Date(input.startAt) }               : {}),
      ...(input.endAt       !== undefined ? { endAt: new Date(input.endAt) }                   : {}),
      ...(input.location    !== undefined ? { location: input.location }                       : {}),
      ...(input.onlineUrl   !== undefined ? { onlineUrl: input.onlineUrl }                     : {}),
      ...(input.capacity    !== undefined ? { capacity: input.capacity }                       : {}),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(input.status      !== undefined ? { status: input.status as any }                    : {}),
    },
    include: { _count: { select: { rsvps: true } } },
  });

  log.info('updateEvent — updated', { eventId, adminId });

  await auditLog({
    adminId,
    action: 'UPDATE_EVENT',
    entity: 'Event',
    entityId: eventId,
    ipAddress,
    metadata: input,
  });

  return toEventAdminDto(row);
}

// ─── archiveEvent ─────────────────────────────────────────────────────────────

export async function archiveEvent(
  eventId: string,
  adminId: string,
  ipAddress: string,
): Promise<void> {
  const existing = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, status: true },
  });
  if (!existing) throw new EventAdminNotFoundError();
  if (existing.status === EventStatus.CANCELLED) throw new EventAlreadyArchivedError();

  await prisma.event.update({
    where: { id: eventId },
    data: { status: EventStatus.CANCELLED },
  });

  log.info('archiveEvent — cancelled', { eventId, adminId });

  await auditLog({
    adminId,
    action: 'ARCHIVE_EVENT',
    entity: 'Event',
    entityId: eventId,
    ipAddress,
    metadata: {},
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toEventAdminDto(row: {
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
  _count: { rsvps: number };
}): EventAdminDto {
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
    rsvpCount: row._count.rsvps,
    createdAt: row.createdAt.toISOString(),
  };
}
