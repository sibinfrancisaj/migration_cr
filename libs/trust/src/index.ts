import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';
import { FlagReason } from '@abroad-matrimony/shared';

const log = createChildLogger({ module: 'trust' });

// ─── Custom errors ────────────────────────────────────────────────────────────

export class AlreadyBlockedError extends Error {
  constructor() {
    super('USER_ALREADY_BLOCKED');
    this.name = 'AlreadyBlockedError';
  }
}

export class BlockNotFoundError extends Error {
  constructor() {
    super('BLOCK_NOT_FOUND');
    this.name = 'BlockNotFoundError';
  }
}

export class BlockSelfError extends Error {
  constructor() {
    super('CANNOT_BLOCK_SELF');
    this.name = 'BlockSelfError';
  }
}

export class ReportSelfError extends Error {
  constructor() {
    super('CANNOT_REPORT_SELF');
    this.name = 'ReportSelfError';
  }
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface BlockDto {
  id: string;
  blockedUserId: string;
  blockedUserName: string | null;
  createdAt: string;
}

export interface ReportDto {
  id: string;
  targetUserId: string;
  reason: string;
  description: string | null;
  status: string;
  createdAt: string;
}

export interface SignalsDto {
  profileViews7d: number;
  profileViews30d: number;
  connectionRequestsSent7d: number;
  connectionRequestsReceived7d: number;
  matchRate: number;
  introductionsThisWeek: number;
  checkInsStreak: number;
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Block a user.
 *
 * Side effects:
 *  - Any pending connection between the two users is cancelled.
 *
 * @throws {BlockSelfError}
 * @throws {AlreadyBlockedError}
 */
export async function blockUser(
  blockerId: string,
  blockedId: string,
  reason?: string,
): Promise<BlockDto> {
  if (blockerId === blockedId) throw new BlockSelfError();

  const existing = await prisma.userBlock.findUnique({
    where: { blockerId_blockedId: { blockerId, blockedId } },
    select: { id: true },
  });

  if (existing) throw new AlreadyBlockedError();

  const [block] = await prisma.$transaction([
    prisma.userBlock.create({
      data: { blockerId, blockedId, reason: reason ?? null },
      include: {
        blocked: { select: { profile: { select: { name: true } } } },
      },
    }),
    // Cancel any pending connection in either direction
    prisma.connection.updateMany({
      where: {
        OR: [
          { senderId: blockerId, receiverId: blockedId, status: 'PENDING' },
          { senderId: blockedId, receiverId: blockerId, status: 'PENDING' },
        ],
      },
      data: { status: 'CANCELLED' },
    }),
  ]);

  log.info('blockUser — blocked', { blockerId, blockedId });

  return {
    id: block.id,
    blockedUserId: block.blockedId,
    blockedUserName: block.blocked.profile?.name ?? null,
    createdAt: block.createdAt.toISOString(),
  };
}

/**
 * Unblock a user.
 *
 * @throws {BlockNotFoundError}
 */
export async function unblockUser(
  blockerId: string,
  blockedId: string,
): Promise<void> {
  const block = await prisma.userBlock.findUnique({
    where: { blockerId_blockedId: { blockerId, blockedId } },
    select: { id: true },
  });

  if (!block) throw new BlockNotFoundError();

  await prisma.userBlock.delete({
    where: { blockerId_blockedId: { blockerId, blockedId } },
  });

  log.info('unblockUser — unblocked', { blockerId, blockedId });
}

/**
 * List all users blocked by the caller.
 */
export async function listBlocks(blockerId: string): Promise<BlockDto[]> {
  const rows = await prisma.userBlock.findMany({
    where: { blockerId },
    orderBy: { createdAt: 'desc' },
    include: {
      blocked: { select: { profile: { select: { name: true } } } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    blockedUserId: row.blockedId,
    blockedUserName: row.blocked.profile?.name ?? null,
    createdAt: row.createdAt.toISOString(),
  }));
}

/**
 * Report a user for a trust/safety violation.
 *
 * Creates a Flag record with targetEntityType = 'user'.
 *
 * @throws {ReportSelfError}
 */
export async function reportUser(
  reporterId: string,
  targetUserId: string,
  reason: FlagReason,
  description?: string,
): Promise<ReportDto> {
  if (reporterId === targetUserId) throw new ReportSelfError();

  const flag = await prisma.flag.create({
    data: {
      reporterId,
      targetUserId,
      targetEntityType: 'user',
      targetEntityId: targetUserId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      reason: reason as any,
      description: description ?? null,
    },
  });

  log.info('reportUser — reported', { reporterId, targetUserId, reason });

  return {
    id: flag.id,
    targetUserId: flag.targetUserId,
    reason: flag.reason,
    description: flag.description,
    status: flag.status,
    createdAt: flag.createdAt.toISOString(),
  };
}

/**
 * Compute engagement signals for a user.
 * These are lightweight read-only metrics derived from existing tables.
 */
export async function getSignals(userId: string): Promise<SignalsDto> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

  const weekKey = _currentWeekKey();

  const [
    connectionsSent7d,
    connectionsReceived7d,
    totalAccepted,
    totalSent,
    introductions,
    checkIns,
  ] = await Promise.all([
    prisma.connection.count({
      where: { senderId: userId, createdAt: { gte: sevenDaysAgo } },
    }),
    prisma.connection.count({
      where: { receiverId: userId, createdAt: { gte: sevenDaysAgo } },
    }),
    prisma.connection.count({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
        status: 'ACCEPTED',
      },
    }),
    prisma.connection.count({
      where: { senderId: userId },
    }),
    prisma.introduction.count({
      where: {
        weekKey,
        OR: [{ userAId: userId }, { userBId: userId }],
      },
    }),
    prisma.checkIn.findMany({
      where: { userId },
      orderBy: { submittedAt: 'desc' },
      take: 10,
      select: { weekKey: true },
    }),
  ]);

  // Compute check-in streak (consecutive weeks)
  const checkInStreak = _computeWeeklyStreak(checkIns.map((c) => c.weekKey));

  // Match rate = accepted / sent (0 if none sent)
  const matchRate = totalSent > 0 ? Math.round((totalAccepted / totalSent) * 100) : 0;

  // thirtyDaysAgo reserved for profile view tracking (future feature)
  void thirtyDaysAgo;

  // Profile views: placeholder (requires a view tracking table)
  return {
    profileViews7d: 0,
    profileViews30d: 0,
    connectionRequestsSent7d: connectionsSent7d,
    connectionRequestsReceived7d: connectionsReceived7d,
    matchRate,
    introductionsThisWeek: introductions,
    checkInsStreak: checkInStreak,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _currentWeekKey(): string {
  const d = new Date();
  const dayOfWeek = d.getUTCDay() || 7;
  const thursday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 4 - dayOfWeek));
  const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${thursday.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function _computeWeeklyStreak(weekKeys: string[]): number {
  if (weekKeys.length === 0) return 0;
  const sorted = [...weekKeys].sort().reverse();
  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = _weekKeyToDate(sorted[i - 1]);
    const curr = _weekKeyToDate(sorted[i]);
    const diff = (prev.getTime() - curr.getTime()) / (7 * 86400000);
    if (Math.abs(diff - 1) < 0.1) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

function _weekKeyToDate(weekKey: string): Date {
  const [year, week] = weekKey.split('-W').map(Number);
  const d = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const dow = d.getUTCDay();
  if (dow <= 4) d.setUTCDate(d.getUTCDate() - dow + 1);
  else d.setUTCDate(d.getUTCDate() + 8 - dow);
  return d;
}
