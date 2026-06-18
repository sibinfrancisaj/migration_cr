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

// ─── Trust Center (TRUST-001 / TRUST-002) ────────────────────────────────────

export class TrustCenterNotFoundError extends Error {
  constructor() {
    super('TRUST_CENTER_NOT_FOUND');
    this.name = 'TrustCenterNotFoundError';
  }
}

export interface TrustLayer {
  key: string;
  label: string;
  completed: boolean;
  points: number;
}

export interface PrivacySettingsDto {
  showPhotosBeforeMutual: boolean;
  showBioBeforeMutual: boolean;
  showAnswersBeforeMutual: boolean;
}

export interface TrustCenterDto {
  trustScore: number;
  maxScore: number;
  layers: TrustLayer[];
  isPaused: boolean;
  privacySettings: PrivacySettingsDto;
}

const DEFAULT_PRIVACY: PrivacySettingsDto = {
  showPhotosBeforeMutual: true,
  showBioBeforeMutual: true,
  showAnswersBeforeMutual: false,
};

const TRUST_LAYERS_CONFIG: Array<{ key: string; label: string; points: number }> = [
  { key: 'PHONE_VERIFIED',   label: 'Phone verified',          points: 20 },
  { key: 'PROFILE_COMPLETE', label: 'Profile complete (≥80%)', points: 20 },
  { key: 'PHOTO_UPLOADED',   label: 'Photo uploaded',          points: 15 },
  { key: 'ID_VERIFIED',      label: 'Identity verified',       points: 25 },
  { key: 'EMAIL_VERIFIED',   label: 'Email verified',          points: 10 },
  { key: 'VOICE_INTRO',      label: 'Voice intro recorded',    points: 10 },
];

/**
 * Returns the trust center for a user: composite score, per-layer breakdown,
 * pause state, and privacy settings.
 *
 * @throws {TrustCenterNotFoundError}
 */
export async function getTrustCenter(userId: string): Promise<TrustCenterDto> {
  const [user, profile, mediaCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { isPhoneVerified: true, isEmailVerified: true },
    }),
    prisma.profile.findUnique({
      where: { userId },
      select: {
        completionScore: true,
        verificationStatus: true,
        voiceIntroTranscript: true,
        isPaused: true,
        privacySettings: true,
      },
    }),
    prisma.media.count({ where: { userId } }),
  ]);

  if (!user || !profile) throw new TrustCenterNotFoundError();

  const completedMap: Record<string, boolean> = {
    PHONE_VERIFIED:   user.isPhoneVerified,
    PROFILE_COMPLETE: profile.completionScore >= 80,
    PHOTO_UPLOADED:   mediaCount > 0,
    ID_VERIFIED:      profile.verificationStatus === 'APPROVED',
    EMAIL_VERIFIED:   user.isEmailVerified,
    VOICE_INTRO:      profile.voiceIntroTranscript !== null,
  };

  const layers: TrustLayer[] = TRUST_LAYERS_CONFIG.map((cfg) => ({
    key:       cfg.key,
    label:     cfg.label,
    completed: completedMap[cfg.key] ?? false,
    points:    cfg.points,
  }));

  const trustScore = layers
    .filter((l) => l.completed)
    .reduce((sum, l) => sum + l.points, 0);

  // Persist updated score
  await prisma.profile.update({
    where: { userId },
    data: { trustScore },
    select: { id: true },
  });

  const raw = profile.privacySettings as Partial<PrivacySettingsDto> | null;
  const privacySettings: PrivacySettingsDto = {
    showPhotosBeforeMutual:  raw?.showPhotosBeforeMutual  ?? DEFAULT_PRIVACY.showPhotosBeforeMutual,
    showBioBeforeMutual:     raw?.showBioBeforeMutual     ?? DEFAULT_PRIVACY.showBioBeforeMutual,
    showAnswersBeforeMutual: raw?.showAnswersBeforeMutual ?? DEFAULT_PRIVACY.showAnswersBeforeMutual,
  };

  log.info('getTrustCenter — computed', { userId, trustScore });

  return {
    trustScore,
    maxScore: 100,
    layers,
    isPaused: profile.isPaused,
    privacySettings,
  };
}

// ─── Privacy Controls (TRUST-003) ─────────────────────────────────────────────

export class PrivacyProfileNotFoundError extends Error {
  constructor() {
    super('PROFILE_NOT_FOUND');
    this.name = 'PrivacyProfileNotFoundError';
  }
}

/**
 * Update the privacy settings for a user's profile.
 *
 * @throws {PrivacyProfileNotFoundError}
 */
export async function setPrivacyControls(
  userId: string,
  settings: Partial<PrivacySettingsDto>,
): Promise<PrivacySettingsDto> {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { privacySettings: true },
  });

  if (!profile) throw new PrivacyProfileNotFoundError();

  const current = profile.privacySettings as Partial<PrivacySettingsDto> | null;
  const merged: PrivacySettingsDto = {
    showPhotosBeforeMutual:  settings.showPhotosBeforeMutual  ?? current?.showPhotosBeforeMutual  ?? DEFAULT_PRIVACY.showPhotosBeforeMutual,
    showBioBeforeMutual:     settings.showBioBeforeMutual     ?? current?.showBioBeforeMutual     ?? DEFAULT_PRIVACY.showBioBeforeMutual,
    showAnswersBeforeMutual: settings.showAnswersBeforeMutual ?? current?.showAnswersBeforeMutual ?? DEFAULT_PRIVACY.showAnswersBeforeMutual,
  };

  await prisma.profile.update({
    where: { userId },
    data: { privacySettings: merged },
    select: { id: true },
  });

  log.info('setPrivacyControls — updated', { userId });

  return merged;
}

// ─── Pause Visibility (TRUST-004 / TRUST-005) ─────────────────────────────────

export class PauseProfileNotFoundError extends Error {
  constructor() {
    super('PROFILE_NOT_FOUND');
    this.name = 'PauseProfileNotFoundError';
  }
}

/**
 * Explicitly pause a profile (hide from discovery).
 *
 * @throws {PauseProfileNotFoundError}
 */
export async function pauseVisibility(userId: string): Promise<{ isPaused: boolean }> {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!profile) throw new PauseProfileNotFoundError();

  await prisma.profile.update({ where: { userId }, data: { isPaused: true } });

  log.info('pauseVisibility — paused', { userId });

  return { isPaused: true };
}

/**
 * Explicitly resume a profile (reappear in discovery).
 *
 * @throws {PauseProfileNotFoundError}
 */
export async function resumeVisibility(userId: string): Promise<{ isPaused: boolean }> {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { id: true },
  });

  if (!profile) throw new PauseProfileNotFoundError();

  await prisma.profile.update({ where: { userId }, data: { isPaused: false } });

  log.info('resumeVisibility — resumed', { userId });

  return { isPaused: false };
}

// ─── Access Levels (TRUST-009) ─────────────────────────────────────────────────

export interface AccessLevelDto {
  key: string;
  label: string;
  description: string;
  visibleFields: string[];
}

/**
 * Returns the static definition of the three profile access levels.
 * Pure function — no DB call.
 */
export function getAccessLevelDefinitions(): AccessLevelDto[] {
  return [
    {
      key: 'PUBLIC',
      label: 'Public',
      description: 'Visible to everyone in the discover feed before any connection.',
      visibleFields: ['name', 'age', 'currentCity', 'currentCountry', 'gender', 'verificationStatus', 'completionScore'],
    },
    {
      key: 'TRUSTED',
      label: 'Trusted',
      description: 'Visible after a connection is accepted. Full profile detail.',
      visibleFields: ['bio', 'allPhotos', 'realLifeAnswers', 'storyPrompts', 'voiceIntro', 'trustScore'],
    },
    {
      key: 'FAMILY',
      label: 'Family-aware',
      description: 'Extended detail shared when both families are involved in the process.',
      visibleFields: ['contactDetails', 'familyBackground', 'settlementIntent', 'careerDetails'],
    },
  ];
}
