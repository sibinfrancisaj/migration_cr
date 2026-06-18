/**
 * IDROP-001 — IntroductionDrop service layer.
 *
 * Provides user-facing drop operations:
 *   - listDropsForUser   — all LIVE drops where the user has curated pairings
 *   - getDropDetail      — drop info + user's pairings (blurred / unlocked based on state)
 *   - earlyAccessDrop    — spend earlyAccessCost diamonds; returns profile cards
 *   - unlockDropEarly    — spend incremental diamonds; returns full profiles
 *
 * Diamond operations delegate to `@abroad-matrimony/payment` (spendDiamonds).
 */
import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';
import { DiamondReason } from '@abroad-matrimony/shared';
import { spendDiamonds, InsufficientDiamondsError } from '@abroad-matrimony/payment';

const log = createChildLogger({ module: 'introductions:drops' });

// ─── Error classes ────────────────────────────────────────────────────────────

export class IntroductionDropNotFoundError extends Error {
  constructor() {
    super('INTRODUCTION_DROP_NOT_FOUND');
    this.name = 'IntroductionDropNotFoundError';
  }
}

export class DropNotLiveError extends Error {
  constructor() {
    super('DROP_NOT_LIVE');
    this.name = 'DropNotLiveError';
  }
}

export class InsufficientDiamondsForDropError extends Error {
  constructor() {
    super('INSUFFICIENT_DIAMONDS_FOR_DROP');
    this.name = 'InsufficientDiamondsForDropError';
  }
}

export class AlreadyUnlockedError extends Error {
  constructor() {
    super('ALREADY_UNLOCKED');
    this.name = 'AlreadyUnlockedError';
  }
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface IntroductionDropSummaryDto {
  id: string;
  name: string;
  status: string;
  releaseAt: string | null;
  expiresAt: string | null;
  earlyAccessCost: number;
  unlockCost: number;
  pairingCount: number;
  isEarlyAccessed: boolean;
  isUnlocked: boolean;
}

export interface IntroductionPairingDto {
  introId: string;
  status: string;
  viewedEarlyAt: string | null;
  unlockedEarlyAt: string | null;
  // Profile info — amount of detail depends on unlock status
  userId: string;
  name: string;
  photoUrl: string | null;
  // Only present when unlockedEarlyAt is set OR drop releaseAt has passed
  currentCity?: string;
  currentCountry?: string;
  profession?: string;
  verificationStatus?: string;
}

export interface IntroductionDropDetailDto {
  id: string;
  name: string;
  criteria: unknown;
  status: string;
  releaseAt: string | null;
  expiresAt: string | null;
  earlyAccessCost: number;
  unlockCost: number;
  pairings: IntroductionPairingDto[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PROFILE_INCLUDE = {
  select: {
    id: true,
    profile: {
      select: {
        name: true,
        currentCity: true,
        currentCountry: true,
        verificationStatus: true,
      },
    },
    profileMedia: {
      select: { url: true },
      where: { position: 0 },
      take: 1,
    },
  },
};

function buildPairingDto(
  intro: {
    id: string;
    status: string;
    userAId: string;
    viewedEarlyAt: Date | null;
    unlockedEarlyAt: Date | null;
    userB: {
      id: string;
      profile: { name: string; currentCity: string; currentCountry: string; verificationStatus: string } | null;
      profileMedia: { url: string }[];
    } | null;
  },
  dropReleaseAt: Date | null,
): IntroductionPairingDto {
  const isReleased = dropReleaseAt != null && dropReleaseAt <= new Date();
  const showFullProfile = isReleased || intro.unlockedEarlyAt != null;
  const profile = intro.userB?.profile ?? null;

  const base: IntroductionPairingDto = {
    introId: intro.id,
    status: intro.status,
    viewedEarlyAt: intro.viewedEarlyAt?.toISOString() ?? null,
    unlockedEarlyAt: intro.unlockedEarlyAt?.toISOString() ?? null,
    userId: intro.userB?.id ?? '',
    name: showFullProfile ? (profile?.name ?? '') : 'Hidden',
    photoUrl: intro.userB?.profileMedia?.[0]?.url ?? null,
  };

  if (showFullProfile && profile) {
    base.currentCity = profile.currentCity;
    base.currentCountry = profile.currentCountry;
    base.verificationStatus = profile.verificationStatus;
  }

  return base;
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * List all LIVE drops where the user has curated pairings.
 */
export async function listDropsForUser(userId: string): Promise<IntroductionDropSummaryDto[]> {
  const drops = await prisma.introductionDrop.findMany({
    where: {
      status: 'LIVE' as any,
      introductions: {
        some: { userAId: userId },
      },
    },
    orderBy: { releaseAt: 'asc' },
    include: {
      introductions: {
        where: { userAId: userId },
        select: { id: true, viewedEarlyAt: true, unlockedEarlyAt: true },
      },
    },
  });

  return drops.map((drop) => {
    const pairings = drop.introductions;
    return {
      id: drop.id,
      name: drop.name,
      status: drop.status,
      releaseAt: drop.releaseAt?.toISOString() ?? null,
      expiresAt: drop.expiresAt?.toISOString() ?? null,
      earlyAccessCost: drop.earlyAccessCost,
      unlockCost: drop.unlockCost,
      pairingCount: pairings.length,
      isEarlyAccessed: pairings.some((p) => p.viewedEarlyAt != null),
      isUnlocked: pairings.some((p) => p.unlockedEarlyAt != null),
    };
  });
}

/**
 * Get detailed drop info with user's curated pairings.
 * Profile info is blurred until the drop is released or the user unlocks early.
 */
export async function getDropDetail(
  dropId: string,
  userId: string,
): Promise<IntroductionDropDetailDto> {
  const drop = await prisma.introductionDrop.findUnique({
    where: { id: dropId },
    include: {
      introductions: {
        where: { userAId: userId },
        include: {
          userB: PROFILE_INCLUDE,
        },
      },
    },
  });

  if (!drop) throw new IntroductionDropNotFoundError();

  return {
    id: drop.id,
    name: drop.name,
    criteria: drop.criteria,
    status: drop.status,
    releaseAt: drop.releaseAt?.toISOString() ?? null,
    expiresAt: drop.expiresAt?.toISOString() ?? null,
    earlyAccessCost: drop.earlyAccessCost,
    unlockCost: drop.unlockCost,
    pairings: drop.introductions.map((intro) => buildPairingDto(intro as any, drop.releaseAt)),
  };
}

/**
 * Pay earlyAccessCost diamonds to view profile cards before the drop releases.
 * Idempotent — if already accessed, returns pairings without charging again.
 *
 * @throws {IntroductionDropNotFoundError}
 * @throws {DropNotLiveError} — drop must be SCHEDULED or LIVE
 * @throws {InsufficientDiamondsForDropError}
 */
export async function earlyAccessDrop(
  userId: string,
  dropId: string,
): Promise<IntroductionDropDetailDto> {
  const drop = await prisma.introductionDrop.findUnique({
    where: { id: dropId },
    include: {
      introductions: {
        where: { userAId: userId },
        include: { userB: PROFILE_INCLUDE },
      },
    },
  });

  if (!drop) throw new IntroductionDropNotFoundError();

  // Only SCHEDULED (pairings generated) or LIVE drops allow early access
  if (drop.status !== 'SCHEDULED' && drop.status !== 'LIVE') {
    throw new DropNotLiveError();
  }

  const intros = drop.introductions;
  const alreadyAccessed = intros.length > 0 && intros.every((i) => i.viewedEarlyAt != null);

  if (!alreadyAccessed && drop.earlyAccessCost > 0) {
    try {
      await spendDiamonds(userId, drop.earlyAccessCost, DiamondReason.INTRO_EARLY_VIEW);
    } catch (err) {
      if (err instanceof InsufficientDiamondsError) {
        throw new InsufficientDiamondsForDropError();
      }
      throw err;
    }

    // Stamp viewedEarlyAt on all user's intros in this drop
    await prisma.introduction.updateMany({
      where: { dropId, userAId: userId, viewedEarlyAt: null },
      data: { viewedEarlyAt: new Date() },
    });

    log.info('earlyAccessDrop — early access granted', { userId, dropId, cost: drop.earlyAccessCost });
  }

  return getDropDetail(dropId, userId);
}

/**
 * Pay the incremental diamond cost to fully unlock profiles before release.
 * Must have early-accessed first (viewedEarlyAt must be set).
 *
 * @throws {IntroductionDropNotFoundError}
 * @throws {DropNotLiveError}
 * @throws {AlreadyUnlockedError}
 * @throws {InsufficientDiamondsForDropError}
 */
export async function unlockDropEarly(
  userId: string,
  dropId: string,
): Promise<IntroductionDropDetailDto> {
  const drop = await prisma.introductionDrop.findUnique({
    where: { id: dropId },
    include: {
      introductions: {
        where: { userAId: userId },
        include: { userB: PROFILE_INCLUDE },
      },
    },
  });

  if (!drop) throw new IntroductionDropNotFoundError();

  if (drop.status !== 'SCHEDULED' && drop.status !== 'LIVE') {
    throw new DropNotLiveError();
  }

  const intros = drop.introductions;
  const alreadyUnlocked = intros.length > 0 && intros.every((i) => i.unlockedEarlyAt != null);

  if (alreadyUnlocked) {
    throw new AlreadyUnlockedError();
  }

  const incrementalCost = Math.max(0, drop.unlockCost - drop.earlyAccessCost);

  if (incrementalCost > 0) {
    try {
      await spendDiamonds(userId, incrementalCost, DiamondReason.INTRO_EARLY_UNLOCK);
    } catch (err) {
      if (err instanceof InsufficientDiamondsError) {
        throw new InsufficientDiamondsForDropError();
      }
      throw err;
    }
  }

  // Stamp unlockedEarlyAt and ensure viewedEarlyAt is also set
  const now = new Date();
  await prisma.introduction.updateMany({
    where: { dropId, userAId: userId, unlockedEarlyAt: null },
    data: { unlockedEarlyAt: now, viewedEarlyAt: now },
  });

  log.info('unlockDropEarly — drop unlocked', { userId, dropId, cost: incrementalCost });

  return getDropDetail(dropId, userId);
}
