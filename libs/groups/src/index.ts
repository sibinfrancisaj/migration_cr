import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';
import { GroupStatus, GroupAccessType, EventStatus } from '@abroad-matrimony/shared';

const log = createChildLogger({ module: 'groups' });

// ─── Custom errors ────────────────────────────────────────────────────────────

export class GroupNotFoundError extends Error {
  constructor() {
    super('GROUP_NOT_FOUND');
    this.name = 'GroupNotFoundError';
  }
}

export class AlreadyGroupMemberError extends Error {
  constructor() {
    super('ALREADY_GROUP_MEMBER');
    this.name = 'AlreadyGroupMemberError';
  }
}

export class NotGroupMemberError extends Error {
  constructor() {
    super('NOT_GROUP_MEMBER');
    this.name = 'NotGroupMemberError';
  }
}

export class GroupFullError extends Error {
  constructor() {
    super('GROUP_FULL');
    this.name = 'GroupFullError';
  }
}

export class GroupAccessDeniedError extends Error {
  constructor() {
    super('GROUP_ACCESS_DENIED');
    this.name = 'GroupAccessDeniedError';
  }
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface GroupDto {
  id: string;
  name: string;
  region: string;
  country: string | null;
  description: string | null;
  status: string;
  accessType: string;
  capacity: number;
  maxMembers: number;
  creditCost: number;
  memberCount: number;
  isMember: boolean;
  launchDate: string;
  createdAt: string;
}

export interface GroupMemberDto {
  userId: string;
  name: string;
  currentCity: string;
  currentCountry: string;
  joinedAt: string;
  role: string;
}

export interface GroupEventDto {
  id: string;
  title: string;
  description: string | null;
  status: string;
  tag: string | null;
  startAt: string;
  endAt: string | null;
  location: string | null;
  onlineUrl: string | null;
  capacity: number | null;
  creditCost: number;
  rsvpCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toGroupDto(
  row: {
    id: string;
    name: string;
    region: string;
    country: string | null;
    description: string | null;
    status: string;
    accessType: string;
    capacity: number;
    maxMembers: number;
    creditCost: number;
    launchDate: Date;
    createdAt: Date;
    _count?: { members: number };
  },
  isMember: boolean,
): GroupDto {
  return {
    id: row.id,
    name: row.name,
    region: row.region,
    country: row.country,
    description: row.description,
    status: row.status,
    accessType: row.accessType,
    capacity: row.capacity,
    maxMembers: row.maxMembers,
    creditCost: row.creditCost,
    memberCount: row._count?.members ?? 0,
    isMember,
    launchDate: row.launchDate.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * List active groups matching the user's region/country (or all if global).
 * Includes member count and whether the caller is already a member.
 */
export async function listGroups(
  userId: string,
  country?: string,
  region?: string,
): Promise<GroupDto[]> {
  const where = {
    status: { in: [GroupStatus.FORMING, GroupStatus.ACTIVE] },
    ...(country ? { country } : {}),
    ...(region ? { region } : {}),
  };

  const [rows, memberships] = await Promise.all([
    prisma.group.findMany({
      where,
      orderBy: { launchDate: 'asc' },
      include: { _count: { select: { members: true } } },
    }),
    prisma.groupMember.findMany({
      where: { userId, status: 'ACTIVE' },
      select: { groupId: true },
    }),
  ]);

  const memberGroupIds = new Set(memberships.map((m) => m.groupId));

  return rows.map((row) => toGroupDto(row, memberGroupIds.has(row.id)));
}

/**
 * Get a single group by ID.
 *
 * @throws {GroupNotFoundError}
 */
export async function getGroup(groupId: string, userId: string): Promise<GroupDto> {
  const row = await prisma.group.findUnique({
    where: { id: groupId },
    include: { _count: { select: { members: true } } },
  });

  if (!row) throw new GroupNotFoundError();

  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId } },
    select: { id: true },
  });

  return toGroupDto(row, !!membership);
}

/**
 * Join a group.
 *
 * Rules:
 *  - Group must be FORMING or ACTIVE.
 *  - User must not already be a member.
 *  - Group must not be at maxMembers.
 *  - CREDIT_GATED groups require diamonds (diamond deduction handled at controller level).
 *
 * @throws {GroupNotFoundError}
 * @throws {AlreadyGroupMemberError}
 * @throws {GroupFullError}
 * @throws {GroupAccessDeniedError} — if INVITE_ONLY
 */
export async function joinGroup(groupId: string, userId: string): Promise<void> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { _count: { select: { members: true } } },
  });

  if (!group) throw new GroupNotFoundError();

  if (!(group.status === GroupStatus.FORMING || group.status === GroupStatus.ACTIVE)) {
    throw new GroupNotFoundError();
  }

  if (group.accessType === GroupAccessType.INVITE_ONLY) {
    throw new GroupAccessDeniedError();
  }

  const existing = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId } },
    select: { id: true },
  });

  if (existing) throw new AlreadyGroupMemberError();

  if (group._count.members >= group.maxMembers) {
    throw new GroupFullError();
  }

  await prisma.groupMember.create({
    data: { userId, groupId, status: 'ACTIVE', role: 'MEMBER' },
  });

  log.info('joinGroup — member added', { groupId, userId });
}

/**
 * Leave a group.
 *
 * @throws {GroupNotFoundError}
 * @throws {NotGroupMemberError}
 */
export async function leaveGroup(groupId: string, userId: string): Promise<void> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true },
  });

  if (!group) throw new GroupNotFoundError();

  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId } },
    select: { id: true },
  });

  if (!membership) throw new NotGroupMemberError();

  await prisma.groupMember.update({
    where: { userId_groupId: { userId, groupId } },
    data: { status: 'LEFT' },
  });

  log.info('leaveGroup — member left', { groupId, userId });
}

/**
 * List members of a group (only accessible to current members).
 *
 * @throws {GroupNotFoundError}
 * @throws {NotGroupMemberError}
 */
export async function getGroupMembers(
  groupId: string,
  userId: string,
): Promise<GroupMemberDto[]> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true },
  });

  if (!group) throw new GroupNotFoundError();

  const callerMembership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId } },
    select: { id: true },
  });

  if (!callerMembership) throw new NotGroupMemberError();

  const members = await prisma.groupMember.findMany({
    where: { groupId, status: 'ACTIVE' },
    orderBy: { joinedAt: 'asc' },
    include: {
      user: {
        include: { profile: true },
      },
    },
  });

  return members
    .filter((m) => m.user.profile !== null)
    .map((m) => ({
      userId: m.userId,
      name: m.user.profile!.name,
      currentCity: m.user.profile!.currentCity,
      currentCountry: m.user.profile!.currentCountry,
      joinedAt: m.joinedAt.toISOString(),
      role: m.role,
    }));
}

/**
 * List upcoming events for a group.
 *
 * @throws {GroupNotFoundError}
 */
export async function getGroupEvents(
  groupId: string,
  _userId: string,
): Promise<GroupEventDto[]> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true },
  });

  if (!group) throw new GroupNotFoundError();

  const events = await prisma.event.findMany({
    where: {
      groupId,
      status: { in: [EventStatus.UPCOMING, EventStatus.LIVE] },
    },
    orderBy: { startAt: 'asc' },
    include: { _count: { select: { rsvps: true } } },
  });

  return events.map((ev) => ({
    id: ev.id,
    title: ev.title,
    description: ev.description,
    status: ev.status,
    tag: ev.tag,
    startAt: ev.startAt.toISOString(),
    endAt: ev.endAt?.toISOString() ?? null,
    location: ev.location,
    onlineUrl: ev.onlineUrl,
    capacity: ev.capacity,
    creditCost: ev.creditCost,
    rsvpCount: ev._count.rsvps,
  }));
}
