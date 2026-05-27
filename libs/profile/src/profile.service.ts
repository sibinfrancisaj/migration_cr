import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';
import type { ProfileDto } from '@abroad-matrimony/shared';
import { Gender, VerificationStatus } from '@abroad-matrimony/shared';

const log = createChildLogger({ module: 'profile:service' });

// ── Custom errors ─────────────────────────────────────────────────────────────

/**
 * Thrown when a user attempts to create a second profile.
 * Each user is allowed exactly one profile row.
 */
export class ProfileAlreadyExistsError extends Error {
  constructor() {
    super('PROFILE_ALREADY_EXISTS');
    this.name = 'ProfileAlreadyExistsError';
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CreateProfileInput {
  userId: string;
  name: string;
  dateOfBirth: Date;
  gender: Gender;
  currentCity: string;
  currentCountry: string;
  settlementIntent: string;
  bio?: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * Creates a new profile for a user.
 *
 * Flow:
 *   1. Check if a profile already exists for `userId` — throw ProfileAlreadyExistsError if so.
 *   2. Insert the `profiles` row.
 *   3. Return the full ProfileDto (empty arrays for photos/answers not yet added).
 *
 * Note: `completionScore` starts at 0.  PROF-005 will implement the
 * recalculation logic that updates this field after every profile mutation.
 *
 * @throws {ProfileAlreadyExistsError} if the user already has a profile
 */
export async function createProfileService(input: CreateProfileInput): Promise<ProfileDto> {
  const { userId, name, dateOfBirth, gender, currentCity, currentCountry, settlementIntent, bio } = input;

  // 1. Guard: one profile per user.
  const existing = await prisma.profile.findUnique({ where: { userId } });
  if (existing) {
    log.warn('Profile creation blocked — profile already exists', { userId });
    throw new ProfileAlreadyExistsError();
  }

  // 2. Create the profile row.
  const profile = await prisma.profile.create({
    data: {
      userId,
      name,
      dateOfBirth,
      gender,
      currentCity,
      currentCountry,
      settlementIntent,
      bio,
      // completionScore defaults to 0 — PROF-005 will recalculate.
    },
  });

  log.info('Profile created', { userId, profileId: profile.id });

  // 3. Map Prisma row → ProfileDto.
  // realLifeAnswers, storyPrompts, and photos are empty at creation —
  // they are populated via PROF-002, PROF-003, and PROF-004 respectively.
  return {
    id: profile.id,
    userId: profile.userId,
    name: profile.name,
    dateOfBirth: profile.dateOfBirth,
    gender: profile.gender as Gender,
    currentCity: profile.currentCity,
    currentCountry: profile.currentCountry,
    settlementIntent: profile.settlementIntent,
    bio: profile.bio ?? undefined,
    completionScore: profile.completionScore,
    verificationStatus: profile.verificationStatus as VerificationStatus,
    isVerified: profile.verificationStatus === VerificationStatus.APPROVED,
    photos: [],
    realLifeAnswers: [],
    storyPrompts: [],
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}
