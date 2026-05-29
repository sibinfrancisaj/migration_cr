import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';
import { IntroductionStatus } from '@abroad-matrimony/shared';

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
