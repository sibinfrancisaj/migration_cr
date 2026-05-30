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

/** @deprecated Use AlreadyInGroupError */
export class AlreadyGroupMemberError extends Error {
  constructor() {
    super('ALREADY_GROUP_MEMBER');
    this.name = 'AlreadyGroupMemberError';
  }
}

export class AlreadyInGroupError extends Error {
  constructor() {
    super('ALREADY_IN_GROUP');
    this.name = 'AlreadyInGroupError';
  }
}

/** @deprecated Use NotInGroupError */
export class NotGroupMemberError extends Error {
  constructor() {
    super('NOT_GROUP_MEMBER');
    this.name = 'NotGroupMemberError';
  }
}

export class NotInGroupError extends Error {
  constructor() {
    super('NOT_IN_GROUP');
    this.name = 'NotInGroupError';
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
  type: string;
  region: string;
  country: string | null;
  description: string | null;
  coverImageUrl: string | null;
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

export interface PaginatedGroupMembersResult {
  members: GroupMemberDto[];
  total: number;
  page: number;
  limit: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toGroupDto(
  row: {
    id: string;
    name: string;
    type: string;
    region: string;
    country: string | null;
    description: string | null;
    coverImageUrl: string | null;
    status: string;
    accessType: string;
    capacity: number;
    maxMembers: number;
    creditCost: number;
    memberCount: number;
    launchDate: Date;
    createdAt: Date;
  },
  isMember: boolean,
): GroupDto {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    region: row.region,
    country: row.country,
    description: row.description,
    coverImageUrl: row.coverImageUrl,
    status: row.status,
    accessType: row.accessType,
    capacity: row.capacity,
    maxMembers: row.maxMembers,
    creditCost: row.creditCost,
    memberCount: row.memberCount,
    isMember,
    launchDate: row.launchDate.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

const DEFAULT_SUGGESTED_GROUPS_MAX = 20;

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * List active groups matching the user's region/country (or all if global).
 * Includes membership status for the caller.
 */
export async function listGroups(
  userId: string,
  country?: string,
  region?: string,
): Promise<GroupDto[]> {
  const where = {
    isActive: true,
    status: { in: [GroupStatus.FORMING, GroupStatus.ACTIVE] },
    ...(country ? { country } : {}),
    ...(region ? { region } : {}),
  };

  const [rows, memberships] = await Promise.all([
    prisma.group.findMany({
      where,
      orderBy: { launchDate: 'asc' },
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
 * @throws {GroupNotFoundError}
 * @throws {AlreadyInGroupError}
 * @throws {GroupFullError}
 * @throws {GroupAccessDeniedError} — if INVITE_ONLY
 */
export async function joinGroup(
  userId: string,
  groupId: string,
  joinedVia: 'AUTO' | 'ONBOARDING' | 'HOME_FEED' | 'SEARCH' | 'MANUAL' = 'MANUAL',
): Promise<void> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      status: true,
      accessType: true,
      memberCount: true,
      maxMembers: true,
    },
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
    select: { id: true, status: true },
  });

  if (existing && existing.status === 'ACTIVE') throw new AlreadyInGroupError();

  if (group.memberCount >= group.maxMembers) {
    throw new GroupFullError();
  }

  await prisma.$transaction([
    existing
      ? prisma.groupMember.update({
          where: { userId_groupId: { userId, groupId } },
          data: { status: 'ACTIVE', joinedVia, joinedAt: new Date() },
        })
      : prisma.groupMember.create({
          data: { userId, groupId, status: 'ACTIVE', role: 'MEMBER', joinedVia },
        }),
    prisma.group.update({
      where: { id: groupId },
      data: { memberCount: { increment: 1 } },
    }),
  ]);

  log.info('joinGroup — member added', { groupId, userId, joinedVia });
}

/**
 * Leave a group.
 *
 * @throws {GroupNotFoundError}
 * @throws {NotInGroupError}
 */
export async function leaveGroup(userId: string, groupId: string): Promise<void> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true },
  });

  if (!group) throw new GroupNotFoundError();

  const membership = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId } },
    select: { id: true, status: true },
  });

  if (!membership || membership.status !== 'ACTIVE') throw new NotInGroupError();

  await prisma.$transaction([
    prisma.groupMember.update({
      where: { userId_groupId: { userId, groupId } },
      data: { status: 'LEFT' },
    }),
    prisma.group.update({
      where: { id: groupId },
      data: { memberCount: { decrement: 1 } },
    }),
  ]);

  log.info('leaveGroup — member left', { groupId, userId });
}

/**
 * Auto-join a user into the REGIONAL country-level group when they create a profile.
 * Silently no-ops if no matching REGIONAL group exists.
 */
export async function autoJoinRegionalCountryGroup(
  userId: string,
  country: string,
): Promise<void> {
  const group = await prisma.group.findFirst({
    where: {
      type: 'REGIONAL',
      scope: 'COUNTRY',
      country,
      isActive: true,
      status: { in: [GroupStatus.FORMING, GroupStatus.ACTIVE] },
    },
    select: { id: true, memberCount: true, maxMembers: true, accessType: true },
  });

  if (!group) {
    log.info('autoJoinRegionalCountryGroup — no REGIONAL group found', { country });
    return;
  }

  // Idempotent: skip if already a member
  const existing = await prisma.groupMember.findUnique({
    where: { userId_groupId: { userId, groupId: group.id } },
    select: { id: true, status: true },
  });

  if (existing && existing.status === 'ACTIVE') return;

  if (group.memberCount >= group.maxMembers) {
    log.warn('autoJoinRegionalCountryGroup — group full', { country, groupId: group.id });
    return;
  }

  await prisma.$transaction([
    existing
      ? prisma.groupMember.update({
          where: { userId_groupId: { userId, groupId: group.id } },
          data: { status: 'ACTIVE', joinedVia: 'AUTO', joinedAt: new Date() },
        })
      : prisma.groupMember.create({
          data: { userId, groupId: group.id, status: 'ACTIVE', role: 'MEMBER', joinedVia: 'AUTO' },
        }),
    prisma.group.update({
      where: { id: group.id },
      data: { memberCount: { increment: 1 } },
    }),
  ]);

  log.info('autoJoinRegionalCountryGroup — joined', { country, groupId: group.id, userId });
}

/**
 * Return groups the user is NOT already in, ranked by profile match → member count → recent activity.
 * Filtered to `isActive: true`.
 */
export async function listSuggestedGroups(userId: string, limit = 20): Promise<GroupDto[]> {
  // Fetch the user's current memberships + profile tags for ranking
  const [memberships, userProfile] = await Promise.all([
    prisma.groupMember.findMany({
      where: { userId, status: 'ACTIVE' },
      select: { groupId: true },
    }),
    prisma.profile.findUnique({
      where: { userId },
      select: { currentCountry: true },
    }),
  ]);

  const joinedGroupIds = new Set(memberships.map((m) => m.groupId));

  const candidates = await prisma.group.findMany({
    where: {
      isActive: true,
      status: { in: [GroupStatus.FORMING, GroupStatus.ACTIVE] },
      id: { notIn: Array.from(joinedGroupIds) },
    },
    orderBy: [{ memberCount: 'desc' }],
    take: limit * 3, // over-fetch for client-side re-ranking
  });

  // Rank: country match first, then member count (already sorted by DB)
  const country = userProfile?.currentCountry ?? '';
  const ranked = [
    ...candidates.filter((g) => g.country === country || g.region === country),
    ...candidates.filter((g) => g.country !== country && g.region !== country),
  ].slice(0, limit);

  return ranked.map((row) => toGroupDto(row, false));
}

/**
 * Return suggested groups for onboarding. Limit is read from SystemConfig.SUGGESTED_GROUPS_MAX.
 */
export async function getSuggestedGroupsForOnboarding(userId: string): Promise<GroupDto[]> {
  let limit = DEFAULT_SUGGESTED_GROUPS_MAX;
  try {
    const config = await prisma.systemConfig.findUnique({
      where: { key: 'SUGGESTED_GROUPS_MAX' },
      select: { value: true },
    });
    if (config) {
      const parsed = parseInt(config.value, 10);
      if (!isNaN(parsed) && parsed > 0) limit = parsed;
    }
  } catch {
    // DB miss → use default
  }
  return listSuggestedGroups(userId, limit);
}

/**
 * List members of a group — paginated.
 * All authenticated users can view group members (ADR-015).
 *
 * @throws {GroupNotFoundError}
 */
export async function getGroupMembers(
  groupId: string,
  page = 1,
  limit = 20,
): Promise<PaginatedGroupMembersResult> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { id: true },
  });

  if (!group) throw new GroupNotFoundError();

  const skip = (page - 1) * limit;

  const [members, total] = await Promise.all([
    prisma.groupMember.findMany({
      where: { groupId, status: 'ACTIVE' },
      orderBy: { joinedAt: 'asc' },
      skip,
      take: limit,
      include: {
        user: {
          include: { profile: true },
        },
      },
    }),
    prisma.groupMember.count({ where: { groupId, status: 'ACTIVE' } }),
  ]);

  const memberDtos: GroupMemberDto[] = members
    .filter((m) => m.user.profile !== null)
    .map((m) => ({
      userId: m.userId,
      name: m.user.profile!.name,
      currentCity: m.user.profile!.currentCity,
      currentCountry: m.user.profile!.currentCountry,
      joinedAt: m.joinedAt.toISOString(),
      role: m.role,
    }));

  return { members: memberDtos, total, page, limit };
}

// ─── Re-exports from sub-modules ─────────────────────────────────────────────

export {
  // Feed
  PostNotFoundError,
  PostForbiddenError,
  createPost,
  listPosts,
  deletePost,
  likePost,
  unlikePost,
  addComment,
  listComments,
  pinPost,
  unpinPost,
  type GroupPostDto,
  type GroupPostCommentDto,
  type PaginatedPostsResult,
  type PaginatedCommentsResult,
  type CreatePostData,
} from './feed.service.js';

export {
  // Proposals
  GroupProposalNotFoundError,
  AlreadyProposedError,
  ProposalNotPendingError,
  proposeGroup,
  getGroupProposals,
  approveGroupProposal,
  rejectGroupProposal,
  type GroupProposalDto,
  type ProposeGroupData,
} from './proposal.service.js';

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
