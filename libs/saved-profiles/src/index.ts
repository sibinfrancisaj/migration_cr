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
