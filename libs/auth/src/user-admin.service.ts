/**
 * ADMIN-002 — User management service.
 * Search, view, suspend, unsuspend, ban, and wipe seeded data for users.
 * All mutating operations write an audit log entry.
 */
import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';
import { auditLog } from './audit.service.js';

const log = createChildLogger({ module: 'auth:user-admin' });

export class UserNotFoundError extends Error {
  constructor() { super('USER_NOT_FOUND'); this.name = 'UserNotFoundError'; }
}
export class UserAlreadySuspendedError extends Error {
  constructor() { super('USER_ALREADY_SUSPENDED'); this.name = 'UserAlreadySuspendedError'; }
}
export class UserNotSuspendedError extends Error {
  constructor() { super('USER_NOT_SUSPENDED'); this.name = 'UserNotSuspendedError'; }
}

export interface UserSearchParams {
  search?: string;   // partial match on phone or email
  status?: string;   // UserRole value
  limit?: number;
  cursor?: string;   // userId for cursor-based pagination
}

export interface UserAdminSummaryDto {
  id: string;
  phone: string;
  email: string | null;
  role: string;
  isSeeded: boolean;
  createdAt: string;
  profile: { name: string; completionScore: number; verificationStatus: string } | null;
}

export interface UserAdminDetailDto extends UserAdminSummaryDto {
  devices: Array<{ id: string; fingerprint: string; lastUsedAt: string | null }>;
  membership: { plan: string; status: string; expiresAt: string | null } | null;
  verificationStatus: string;
  openFlagCount: number;
}

// ─── listUsers ──────────────────────────────────────────────────────────────

export async function listUsers(params: UserSearchParams): Promise<{
  users: UserAdminSummaryDto[];
  hasMore: boolean;
  nextCursor: string | null;
}> {
  const limit = Math.min(params.limit ?? 20, 100);

  const users = await prisma.user.findMany({
    where: {
      ...(params.status ? { role: params.status as never } : {}),
      ...(params.search
        ? {
            OR: [
              { phone: { contains: params.search } },
              { email: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(params.cursor ? { id: { gt: params.cursor } } : {}),
    },
    select: {
      id: true,
      phone: true,
      email: true,
      role: true,
      isSeeded: true,
      createdAt: true,
      profile: { select: { name: true, completionScore: true, verificationStatus: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
  });

  const hasMore = users.length > limit;
  const page = users.slice(0, limit);

  return {
    users: page.map((u) => ({
      id: u.id,
      phone: u.phone,
      email: u.email,
      role: u.role as string,
      isSeeded: u.isSeeded,
      createdAt: u.createdAt.toISOString(),
      profile: u.profile
        ? {
            name: u.profile.name,
            completionScore: u.profile.completionScore,
            verificationStatus: u.profile.verificationStatus as string,
          }
        : null,
    })),
    hasMore,
    nextCursor: hasMore ? page[page.length - 1]!.id : null,
  };
}

// ─── getUserAdminDetail ──────────────────────────────────────────────────────

export async function getUserAdminDetail(userId: string): Promise<UserAdminDetailDto> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      phone: true,
      email: true,
      role: true,
      isSeeded: true,
      createdAt: true,
      profile: { select: { name: true, completionScore: true, verificationStatus: true } },
      devices: { select: { id: true, fingerprint: true, lastUsedAt: true }, take: 20 },
      memberships: {
        where: { status: 'ACTIVE' as never },
        select: { plan: true, status: true, expiresAt: true },
        take: 1,
        orderBy: { createdAt: 'desc' },
      },
      flagsReceived: { where: { status: 'OPEN' as never }, select: { id: true } },
    },
  });

  if (!user) throw new UserNotFoundError();

  return {
    id: user.id,
    phone: user.phone,
    email: user.email,
    role: user.role as string,
    isSeeded: user.isSeeded,
    createdAt: user.createdAt.toISOString(),
    profile: user.profile
      ? {
          name: user.profile.name,
          completionScore: user.profile.completionScore,
          verificationStatus: user.profile.verificationStatus as string,
        }
      : null,
    devices: user.devices.map((d) => ({
      id: d.id,
      fingerprint: d.fingerprint,
      lastUsedAt: d.lastUsedAt?.toISOString() ?? null,
    })),
    membership:
      user.memberships[0]
        ? {
            plan: user.memberships[0].plan as string,
            status: user.memberships[0].status as string,
            expiresAt: user.memberships[0].expiresAt?.toISOString() ?? null,
          }
        : null,
    verificationStatus: (user.profile?.verificationStatus as string) ?? 'PENDING',
    openFlagCount: user.flagsReceived.length,
  };
}

// ─── suspendUser ─────────────────────────────────────────────────────────────

export async function suspendUser(
  userId: string,
  adminId: string,
  reason: string,
  ipAddress: string,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  if (!user) throw new UserNotFoundError();
  if (user.role === 'SUSPENDED') throw new UserAlreadySuspendedError();

  await prisma.user.update({ where: { id: userId }, data: { role: 'SUSPENDED' as never } });

  await auditLog({
    adminUserId: adminId,
    action: 'USER_SUSPENDED',
    entity: 'User',
    entityId: userId,
    before: { role: user.role },
    after: { role: 'SUSPENDED', reason },
    ipAddress,
  });

  log.info('User suspended', { userId, adminId, reason });
}

// ─── unsuspendUser ───────────────────────────────────────────────────────────

export async function unsuspendUser(
  userId: string,
  adminId: string,
  ipAddress: string,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  if (!user) throw new UserNotFoundError();
  if (user.role !== 'SUSPENDED') throw new UserNotSuspendedError();

  await prisma.user.update({ where: { id: userId }, data: { role: 'USER' as never } });

  await auditLog({
    adminUserId: adminId,
    action: 'USER_UNSUSPENDED',
    entity: 'User',
    entityId: userId,
    before: { role: 'SUSPENDED' },
    after: { role: 'USER' },
    ipAddress,
  });

  log.info('User unsuspended', { userId, adminId });
}

// ─── banUser ─────────────────────────────────────────────────────────────────

export async function banUser(
  userId: string,
  adminId: string,
  reason: string,
  ipAddress: string,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true } });
  if (!user) throw new UserNotFoundError();

  // Ban: mark BANNED (re-use SUSPENDED slot) + revoke all refresh tokens
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { role: 'SUSPENDED' as never } }),
    prisma.refreshToken.updateMany({ where: { userId }, data: { revokedAt: new Date() } }),
  ]);

  await auditLog({
    adminUserId: adminId,
    action: 'USER_BANNED',
    entity: 'User',
    entityId: userId,
    before: { role: user.role },
    after: { role: 'SUSPENDED', reason, permanentBan: true },
    ipAddress,
  });

  log.info('User banned', { userId, adminId, reason });
}

// ─── wipeSeededUser ──────────────────────────────────────────────────────────

export async function wipeSeededUser(
  userId: string,
  adminId: string,
  ipAddress: string,
): Promise<{ deletedEntityTypes: string[] }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isSeeded: true },
  });
  if (!user) throw new UserNotFoundError();

  // Delete only seeded records belonging to this user (cascade-safe order)
  await prisma.$transaction([
    prisma.habitLog.deleteMany({ where: { userId } }),
    prisma.promptResonate.deleteMany({ where: { userId } }),
    prisma.promptResponse.deleteMany({ where: { userId } }),
    prisma.groupPostLike.deleteMany({ where: { userId } }),
    prisma.groupPostComment.deleteMany({ where: { userId } }),
    prisma.groupPost.deleteMany({ where: { userId, isSeeded: true } }),
    prisma.savedProfile.deleteMany({ where: { OR: [{ userId }, { targetUserId: userId }] } }),
    prisma.connection.deleteMany({ where: { OR: [{ requesterId: userId }, { recipientId: userId }] } }),
    prisma.introduction.deleteMany({ where: { OR: [{ userAId: userId }, { userBId: userId }] } }),
    prisma.groupMember.deleteMany({ where: { userId } }),
    prisma.userBlock.deleteMany({ where: { OR: [{ blockerId: userId }, { blockedUserId: userId }] } }),
    prisma.media.deleteMany({ where: { userId } }),
    prisma.storyPromptAnswer.deleteMany({ where: { userId } }),
    prisma.realLifeAnswer.deleteMany({ where: { userId } }),
    prisma.profile.deleteMany({ where: { userId } }),
  ]);

  await auditLog({
    adminUserId: adminId,
    action: 'USER_DATA_WIPED',
    entity: 'User',
    entityId: userId,
    before: { isSeeded: user.isSeeded },
    after: { wipedAt: new Date().toISOString() },
    ipAddress,
  });

  return {
    deletedEntityTypes: [
      'habitLogs', 'promptResponses', 'groupPosts', 'savedProfiles',
      'connections', 'introductions', 'groupMemberships', 'media', 'profile',
    ],
  };
}
