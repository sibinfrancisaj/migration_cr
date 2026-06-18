import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';
import { IntroductionStatus, DiamondReason } from '@abroad-matrimony/shared';
import { spendDiamonds, InsufficientDiamondsError } from '@abroad-matrimony/payment';

const log = createChildLogger({ module: 'introductions' });

// ─── Custom errors ────────────────────────────────────────────────────────────

export class IntroductionNotFoundError extends Error {
  constructor() {
    super('INTRODUCTION_NOT_FOUND');
    this.name = 'IntroductionNotFoundError';
  }
}

export class IntroductionForbiddenError extends Error {
  constructor() {
    super('INTRODUCTION_FORBIDDEN');
    this.name = 'IntroductionForbiddenError';
  }
}

export class IntroductionExpiredError extends Error {
  constructor() {
    super('INTRODUCTION_EXPIRED');
    this.name = 'IntroductionExpiredError';
  }
}

export class IntroductionAlreadyRespondedError extends Error {
  constructor() {
    super('INTRODUCTION_ALREADY_RESPONDED');
    this.name = 'IntroductionAlreadyRespondedError';
  }
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface IntroductionDto {
  id: string;
  groupId: string;
  weekKey: string;
  status: string;
  expiresAt: string;
  acceptedByMe: boolean;
  acceptedByOther: boolean;
  otherUser: {
    id: string;
    name: string;
    currentCity: string;
    currentCountry: string;
    verificationStatus: string;
  } | null;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the ISO week key for a given date (YYYY-WXX). */
export function getWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayOfWeek = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayOfWeek);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function toIntroductionDto(
  row: {
    id: string;
    groupId: string;
    weekKey: string;
    status: string;
    expiresAt: Date;
    acceptedByA: boolean;
    acceptedByB: boolean;
    userAId: string;
    userBId: string;
    createdAt: Date;
    userA?: { id: string; profile: { name: string; currentCity: string; currentCountry: string; verificationStatus: string } | null } | null;
    userB?: { id: string; profile: { name: string; currentCity: string; currentCountry: string; verificationStatus: string } | null } | null;
  },
  userId: string,
): IntroductionDto {
  const isUserA = row.userAId === userId;
  const otherUserObj = isUserA ? row.userB : row.userA;
  const otherProfile = otherUserObj?.profile ?? null;

  return {
    id: row.id,
    groupId: row.groupId,
    weekKey: row.weekKey,
    status: row.status,
    expiresAt: row.expiresAt.toISOString(),
    acceptedByMe: isUserA ? row.acceptedByA : row.acceptedByB,
    acceptedByOther: isUserA ? row.acceptedByB : row.acceptedByA,
    otherUser: otherProfile
      ? {
          id: otherUserObj!.id,
          name: otherProfile.name,
          currentCity: otherProfile.currentCity,
          currentCountry: otherProfile.currentCountry,
          verificationStatus: otherProfile.verificationStatus,
        }
      : null,
    createdAt: row.createdAt.toISOString(),
  };
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * List introductions for the current week for a user.
 * Returns all intros where the user is userA or userB.
 */
export async function listCurrentIntroductions(userId: string): Promise<IntroductionDto[]> {
  const weekKey = getWeekKey(new Date());

  const rows = await prisma.introduction.findMany({
    where: {
      weekKey,
      OR: [{ userAId: userId }, { userBId: userId }],
    },
    orderBy: { createdAt: 'desc' },
    include: {
      userA: { select: { id: true, profile: { select: { name: true, currentCity: true, currentCountry: true, verificationStatus: true } } } },
      userB: { select: { id: true, profile: { select: { name: true, currentCity: true, currentCountry: true, verificationStatus: true } } } },
    },
  });

  return rows.map((row) => toIntroductionDto(row, userId));
}

/**
 * List historical introductions for a user (all weeks, excluding current).
 */
export async function listIntroductionHistory(
  userId: string,
  page: number,
  limit: number,
): Promise<{ intros: IntroductionDto[]; total: number }> {
  const weekKey = getWeekKey(new Date());

  const where = {
    weekKey: { not: weekKey },
    OR: [{ userAId: userId }, { userBId: userId }],
  };

  const [rows, total] = await prisma.$transaction([
    prisma.introduction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        userA: { select: { id: true, profile: { select: { name: true, currentCity: true, currentCountry: true, verificationStatus: true } } } },
        userB: { select: { id: true, profile: { select: { name: true, currentCity: true, currentCountry: true, verificationStatus: true } } } },
      },
    }),
    prisma.introduction.count({ where }),
  ]);

  return {
    intros: rows.map((row) => toIntroductionDto(row, userId)),
    total,
  };
}

/**
 * Accept an introduction.
 *
 * When both parties accept → status becomes MATCHED.
 *
 * @throws {IntroductionNotFoundError}
 * @throws {IntroductionForbiddenError}
 * @throws {IntroductionExpiredError}
 * @throws {IntroductionAlreadyRespondedError}
 */
export async function acceptIntroduction(
  introId: string,
  userId: string,
): Promise<IntroductionDto> {
  const intro = await prisma.introduction.findUnique({
    where: { id: introId },
    include: {
      userA: { select: { id: true, profile: { select: { name: true, currentCity: true, currentCountry: true, verificationStatus: true } } } },
      userB: { select: { id: true, profile: { select: { name: true, currentCity: true, currentCountry: true, verificationStatus: true } } } },
    },
  });

  if (!intro) throw new IntroductionNotFoundError();

  const isUserA = intro.userAId === userId;
  const isUserB = intro.userBId === userId;

  if (!isUserA && !isUserB) throw new IntroductionForbiddenError();

  if (intro.status === IntroductionStatus.EXPIRED || intro.expiresAt < new Date()) {
    throw new IntroductionExpiredError();
  }

  if (intro.status === IntroductionStatus.DECLINED) {
    throw new IntroductionAlreadyRespondedError();
  }

  // Check if already accepted by this user
  if ((isUserA && intro.acceptedByA) || (isUserB && intro.acceptedByB)) {
    throw new IntroductionAlreadyRespondedError();
  }

  const bothAccepted = isUserA ? intro.acceptedByB : intro.acceptedByA;
  const newStatus = bothAccepted ? IntroductionStatus.MATCHED : IntroductionStatus.PENDING;

  const updated = await prisma.introduction.update({
    where: { id: introId },
    data: {
      acceptedByA: isUserA ? true : intro.acceptedByA,
      acceptedByB: isUserB ? true : intro.acceptedByB,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      status: newStatus as any,
    },
    include: {
      userA: { select: { id: true, profile: { select: { name: true, currentCity: true, currentCountry: true, verificationStatus: true } } } },
      userB: { select: { id: true, profile: { select: { name: true, currentCity: true, currentCountry: true, verificationStatus: true } } } },
    },
  });

  log.info('acceptIntroduction — accepted', {
    introId,
    userId,
    bothAccepted,
    newStatus,
  });

  return toIntroductionDto(updated, userId);
}

/**
 * Decline an introduction.
 *
 * @throws {IntroductionNotFoundError}
 * @throws {IntroductionForbiddenError}
 * @throws {IntroductionExpiredError}
 * @throws {IntroductionAlreadyRespondedError}
 */
export async function declineIntroduction(
  introId: string,
  userId: string,
): Promise<IntroductionDto> {
  const intro = await prisma.introduction.findUnique({
    where: { id: introId },
    include: {
      userA: { select: { id: true, profile: { select: { name: true, currentCity: true, currentCountry: true, verificationStatus: true } } } },
      userB: { select: { id: true, profile: { select: { name: true, currentCity: true, currentCountry: true, verificationStatus: true } } } },
    },
  });

  if (!intro) throw new IntroductionNotFoundError();

  const isUserA = intro.userAId === userId;
  const isUserB = intro.userBId === userId;

  if (!isUserA && !isUserB) throw new IntroductionForbiddenError();

  if (intro.status === IntroductionStatus.EXPIRED || intro.expiresAt < new Date()) {
    throw new IntroductionExpiredError();
  }

  if (
    intro.status === IntroductionStatus.DECLINED ||
    intro.status === IntroductionStatus.MATCHED
  ) {
    throw new IntroductionAlreadyRespondedError();
  }

  const updated = await prisma.introduction.update({
    where: { id: introId },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: { status: IntroductionStatus.DECLINED as any },
    include: {
      userA: { select: { id: true, profile: { select: { name: true, currentCity: true, currentCountry: true, verificationStatus: true } } } },
      userB: { select: { id: true, profile: { select: { name: true, currentCity: true, currentCountry: true, verificationStatus: true } } } },
    },
  });

  log.info('declineIntroduction — declined', { introId, userId });

  return toIntroductionDto(updated, userId);
}

// ── INTRO-003: Introduction detail ───────────────────────────────────────────

/** Cost in diamonds to view weekly introductions before Sunday's release. */
export const EARLY_UNLOCK_DIAMOND_COST = 300;

export class EarlyUnlockAlreadyDoneError extends Error {
  constructor() {
    super('EARLY_UNLOCK_ALREADY_DONE');
    this.name = 'EarlyUnlockAlreadyDoneError';
  }
}

export class EarlyUnlockInsufficientDiamondsError extends Error {
  constructor() {
    super('EARLY_UNLOCK_INSUFFICIENT_DIAMONDS');
    this.name = 'EarlyUnlockInsufficientDiamondsError';
  }
}

/**
 * Get a single introduction by ID with full detail for the requesting user.
 *
 * @throws {IntroductionNotFoundError}
 * @throws {IntroductionForbiddenError}
 */
export async function getIntroductionDetail(
  introId: string,
  userId: string,
): Promise<IntroductionDto> {
  const intro = await prisma.introduction.findUnique({
    where: { id: introId },
    include: {
      userA: { select: { id: true, profile: { select: { name: true, currentCity: true, currentCountry: true, verificationStatus: true } } } },
      userB: { select: { id: true, profile: { select: { name: true, currentCity: true, currentCountry: true, verificationStatus: true } } } },
    },
  });

  if (!intro) throw new IntroductionNotFoundError();

  const isUserA = intro.userAId === userId;
  const isUserB = intro.userBId === userId;
  if (!isUserA && !isUserB) throw new IntroductionForbiddenError();

  return toIntroductionDto(intro, userId);
}

// ── INTRO-004: Early unlock for current week's introductions ─────────────────

/**
 * Spend EARLY_UNLOCK_DIAMOND_COST diamonds to mark all of this week's
 * introductions as early-viewed. Idempotent — if the user has already unlocked,
 * returns without spending again.
 *
 * @throws {EarlyUnlockInsufficientDiamondsError} if balance < EARLY_UNLOCK_DIAMOND_COST
 */
export async function earlyUnlockWeeklyIntros(userId: string): Promise<{
  unlockedCount: number;
  alreadyUnlocked: boolean;
}> {
  const weekKey = getWeekKey(new Date());

  // Fetch current-week introductions for this user
  const intros = await prisma.introduction.findMany({
    where: {
      weekKey,
      OR: [{ userAId: userId }, { userBId: userId }],
    },
    select: { id: true, viewedEarlyAt: true },
  });

  // Idempotent check — if all are already unlocked, don't charge again
  const alreadyAll = intros.length > 0 && intros.every(i => i.viewedEarlyAt !== null);
  if (alreadyAll) {
    log.info('earlyUnlockWeeklyIntros — already unlocked', { userId, weekKey });
    return { unlockedCount: intros.length, alreadyUnlocked: true };
  }

  // Spend diamonds — may throw InsufficientDiamondsError
  try {
    await spendDiamonds({
      userId,
      amount:      EARLY_UNLOCK_DIAMOND_COST,
      reason:      DiamondReason.INTRO_EARLY_VIEW,
      referenceId: `weekly-unlock:${weekKey}`,
    });
  } catch (err) {
    if (err instanceof InsufficientDiamondsError) {
      throw new EarlyUnlockInsufficientDiamondsError();
    }
    throw err;
  }

  // Mark all current-week intros as viewed
  const viewedEarlyAt = new Date();
  const ids = intros.map(i => i.id);
  await prisma.introduction.updateMany({
    where: { id: { in: ids } },
    data:  { viewedEarlyAt },
  });

  log.info('earlyUnlockWeeklyIntros — unlocked', { userId, weekKey, count: ids.length });
  return { unlockedCount: ids.length, alreadyUnlocked: false };
}

// ─── Phase 8d: IntroductionDrop services ─────────────────────────────────────
export * from './drop.service.js';
export * from './pairing.service.js';
export * from './drop-admin.service.js';

// ─── Phase 10: Why-This-Match + Weekly Drop ───────────────────────────────────
export {
  DIMENSION_LABELS,
  generateWhyThisMatch,
  generateWhyThisMatchLLM,
} from './why-this-match.service.js';
export type { DimensionCard, WhyThisMatchDto } from './why-this-match.service.js';

export { createWeeklyGroupDrops } from './weekly-drop.service.js';
export type { WeeklyDropResult } from './weekly-drop.service.js';

export { createWeeklyDropWorker, triggerWeeklyDropNow } from './weekly-drop.job.js';
