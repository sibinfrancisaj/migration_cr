import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';
import { SavedProfileLabel } from '@abroad-matrimony/shared';

const log = createChildLogger({ module: 'saved-profiles' });

// ─── Custom errors ────────────────────────────────────────────────────────────

export class SavedProfileNotFoundError extends Error {
  constructor() {
    super('SAVED_PROFILE_NOT_FOUND');
    this.name = 'SavedProfileNotFoundError';
  }
}

export class AlreadySavedError extends Error {
  constructor() {
    super('PROFILE_ALREADY_SAVED');
    this.name = 'AlreadySavedError';
  }
}

export class SaveSelfError extends Error {
  constructor() {
    super('CANNOT_SAVE_SELF');
    this.name = 'SaveSelfError';
  }
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface SavedProfileDto {
  id: string;
  userId: string;
  savedUserId: string;
  label: string;
  notes: string | null;
  savedUser: {
    id: string;
    name: string;
    currentCity: string;
    currentCountry: string;
    verificationStatus: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * List all saved profiles for a user.
 * Optionally filter by label.
 */
export async function listSavedProfiles(
  userId: string,
  label?: SavedProfileLabel,
): Promise<SavedProfileDto[]> {
  const rows = await prisma.savedProfile.findMany({
    where: {
      userId,
      ...(label ? { label } : {}),
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      savedUser: { include: { profile: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    savedUserId: row.savedUserId,
    label: row.label,
    notes: row.notes,
    savedUser: row.savedUser.profile
      ? {
          id: row.savedUser.id,
          name: row.savedUser.profile.name,
          currentCity: row.savedUser.profile.currentCity,
          currentCountry: row.savedUser.profile.currentCountry,
          verificationStatus: row.savedUser.profile.verificationStatus,
        }
      : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

/**
 * Save a profile.
 *
 * @throws {SaveSelfError}
 * @throws {AlreadySavedError}
 */
export async function saveProfile(
  userId: string,
  savedUserId: string,
  label: SavedProfileLabel = SavedProfileLabel.INTERESTED,
  notes?: string,
): Promise<SavedProfileDto> {
  if (userId === savedUserId) throw new SaveSelfError();

  const existing = await prisma.savedProfile.findUnique({
    where: { userId_savedUserId: { userId, savedUserId } },
    select: { id: true },
  });

  if (existing) throw new AlreadySavedError();

  const row = await prisma.savedProfile.create({
    data: {
      userId,
      savedUserId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      label: label as any,
      notes: notes ?? null,
    },
    include: {
      savedUser: { include: { profile: true } },
    },
  });

  log.info('saveProfile — saved', { userId, savedUserId, label });

  return {
    id: row.id,
    userId: row.userId,
    savedUserId: row.savedUserId,
    label: row.label,
    notes: row.notes,
    savedUser: row.savedUser.profile
      ? {
          id: row.savedUser.id,
          name: row.savedUser.profile.name,
          currentCity: row.savedUser.profile.currentCity,
          currentCountry: row.savedUser.profile.currentCountry,
          verificationStatus: row.savedUser.profile.verificationStatus,
        }
      : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Update the label or notes for a saved profile.
 *
 * @throws {SavedProfileNotFoundError}
 */
export async function updateSavedProfile(
  userId: string,
  savedUserId: string,
  updates: { label?: SavedProfileLabel; notes?: string },
): Promise<SavedProfileDto> {
  const existing = await prisma.savedProfile.findUnique({
    where: { userId_savedUserId: { userId, savedUserId } },
    select: { id: true },
  });

  if (!existing) throw new SavedProfileNotFoundError();

  const row = await prisma.savedProfile.update({
    where: { userId_savedUserId: { userId, savedUserId } },
    data: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...(updates.label ? { label: updates.label as any } : {}),
      ...(updates.notes !== undefined ? { notes: updates.notes } : {}),
    },
    include: {
      savedUser: { include: { profile: true } },
    },
  });

  log.info('updateSavedProfile — updated', { userId, savedUserId, updates });

  return {
    id: row.id,
    userId: row.userId,
    savedUserId: row.savedUserId,
    label: row.label,
    notes: row.notes,
    savedUser: row.savedUser.profile
      ? {
          id: row.savedUser.id,
          name: row.savedUser.profile.name,
          currentCity: row.savedUser.profile.currentCity,
          currentCountry: row.savedUser.profile.currentCountry,
          verificationStatus: row.savedUser.profile.verificationStatus,
        }
      : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Unsave a profile.
 *
 * @throws {SavedProfileNotFoundError}
 */
export async function unsaveProfile(
  userId: string,
  savedUserId: string,
): Promise<void> {
  const existing = await prisma.savedProfile.findUnique({
    where: { userId_savedUserId: { userId, savedUserId } },
    select: { id: true },
  });

  if (!existing) throw new SavedProfileNotFoundError();

  await prisma.savedProfile.delete({
    where: { userId_savedUserId: { userId, savedUserId } },
  });

  log.info('unsaveProfile — unsaved', { userId, savedUserId });
}

// ─── Compare ──────────────────────────────────────────────────────────────────

export class ProfileNotSavedError extends Error {
  constructor(public readonly profileId: string) {
    super('PROFILE_NOT_SAVED');
    this.name = 'ProfileNotSavedError';
  }
}

export interface RealLifeAnswerSummary {
  questionKey: string;
  answer: string;
}

export interface CompareProfileDto {
  savedProfileId: string;
  savedUserId: string;
  label: string;
  notes: string | null;
  profile: {
    name: string;
    dateOfBirth: string;
    gender: string;
    currentCity: string;
    currentCountry: string;
    settlementIntent: string;
    bio: string | null;
    completionScore: number;
    verificationStatus: string;
    trustScore: number;
  } | null;
  realLifeAnswers: RealLifeAnswerSummary[];
}

/**
 * Return enriched comparison data for 2–3 saved profiles.
 * All profileIds must be saved by the requesting user.
 *
 * @throws {ProfileNotSavedError} if any profileId is not saved by userId
 */
export async function compareSavedProfiles(
  userId: string,
  profileIds: string[],
): Promise<CompareProfileDto[]> {
  const rows = await prisma.savedProfile.findMany({
    where: { userId, savedUserId: { in: profileIds } },
    include: {
      savedUser: {
        include: {
          profile: { include: { realLifeAnswers: true } },
        },
      },
    },
  });

  const foundIds = new Set(rows.map((r) => r.savedUserId));
  for (const pid of profileIds) {
    if (!foundIds.has(pid)) throw new ProfileNotSavedError(pid);
  }

  return profileIds.map((pid) => {
    const row = rows.find((r) => r.savedUserId === pid)!;
    const profile = row.savedUser.profile;
    return {
      savedProfileId: row.id,
      savedUserId: row.savedUserId,
      label: row.label,
      notes: row.notes,
      profile: profile
        ? {
            name: profile.name,
            dateOfBirth: profile.dateOfBirth.toISOString(),
            gender: profile.gender,
            currentCity: profile.currentCity,
            currentCountry: profile.currentCountry,
            settlementIntent: profile.settlementIntent,
            bio: profile.bio,
            completionScore: profile.completionScore,
            verificationStatus: profile.verificationStatus,
            trustScore: profile.trustScore,
          }
        : null,
      realLifeAnswers: (profile?.realLifeAnswers ?? []).map((a) => ({
        questionKey: a.questionKey,
        answer: a.answer,
      })),
    };
  });
}
