import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';
import type { ProfileDto, MediaDto, RealLifeAnswerDto, StoryPromptAnswerDto } from '@abroad-matrimony/shared';
import { Gender, MediaType, RealLifeQuestionKey, StoryPromptKey, VerificationStatus } from '@abroad-matrimony/shared';
import { ProfileNotFoundError } from './real-life-answer.service.js';

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
  return toProfileDto(profile, [], [], []);
}

// ── Get own profile ───────────────────────────────────────────────────────────

/**
 * Fetches the full ProfileDto for the authenticated user, including their
 * real-life answers, story prompts, and photos.
 *
 * @throws {ProfileNotFoundError} if the user has not yet created a profile
 */
export async function getOwnProfile(userId: string): Promise<ProfileDto> {
  const [profile, answers, storyAnswers, photos] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.realLifeAnswer.findMany({
      where:   { userId },
      orderBy: { questionKey: 'asc' },
    }),
    prisma.storyPromptAnswer.findMany({
      where:   { userId },
      orderBy: { promptKey: 'asc' },
    }),
    prisma.media.findMany({
      where:   { userId, type: MediaType.PHOTO },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    }),
  ]);

  if (!profile) {
    log.warn('getOwnProfile — no profile found', { userId });
    throw new ProfileNotFoundError();
  }

  return toProfileDto(profile, answers, storyAnswers, photos);
}

// ── Get profile by ID ─────────────────────────────────────────────────────────

/**
 * Fetches a ProfileDto by profile ID (for public browse / matching views).
 *
 * @throws {ProfileNotFoundError} if no profile exists with the given ID
 */
export async function getProfileById(profileId: string): Promise<ProfileDto> {
  const profile = await prisma.profile.findUnique({ where: { id: profileId } });

  if (!profile) {
    log.warn('getProfileById — no profile found', { profileId });
    throw new ProfileNotFoundError();
  }

  const { userId } = profile;
  const [answers, storyAnswers, photos] = await Promise.all([
    prisma.realLifeAnswer.findMany({
      where:   { userId },
      orderBy: { questionKey: 'asc' },
    }),
    prisma.storyPromptAnswer.findMany({
      where:   { userId },
      orderBy: { promptKey: 'asc' },
    }),
    prisma.media.findMany({
      where:   { userId, type: MediaType.PHOTO },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    }),
  ]);

  return toProfileDto(profile, answers, storyAnswers, photos);
}

// ── Private mapper ────────────────────────────────────────────────────────────

type ProfileRow        = Awaited<ReturnType<typeof prisma.profile.findUniqueOrThrow>>;
type RealLifeAnswerRow = Awaited<ReturnType<typeof prisma.realLifeAnswer.findMany>>[number];
type StoryAnswerRow    = Awaited<ReturnType<typeof prisma.storyPromptAnswer.findMany>>[number];
type MediaRow          = Awaited<ReturnType<typeof prisma.media.findMany>>[number];

function toProfileDto(
  profile:      ProfileRow,
  answers:      RealLifeAnswerRow[],
  storyAnswers: StoryAnswerRow[],
  photos:       MediaRow[],
): ProfileDto {
  return {
    id:               profile.id,
    userId:           profile.userId,
    name:             profile.name,
    dateOfBirth:      profile.dateOfBirth,
    gender:           profile.gender as Gender,
    currentCity:      profile.currentCity,
    currentCountry:   profile.currentCountry,
    settlementIntent: profile.settlementIntent,
    bio:              profile.bio ?? undefined,
    completionScore:  profile.completionScore,
    verificationStatus: profile.verificationStatus as VerificationStatus,
    isVerified:       profile.verificationStatus === VerificationStatus.APPROVED,
    photos: photos.map((p): MediaDto => ({
      id:         p.id,
      type:       p.type as MediaType,
      url:        p.url,
      order:      p.order ?? undefined,
      isVerified: p.isVerified,
      createdAt:  p.createdAt,
    })),
    realLifeAnswers: answers.map((a): RealLifeAnswerDto => ({
      questionKey: a.questionKey as RealLifeQuestionKey,
      value:       a.value as string | string[],
      updatedAt:   a.updatedAt,
    })),
    storyPrompts: storyAnswers.map((s): StoryPromptAnswerDto => ({
      promptKey: s.promptKey as StoryPromptKey,
      answer:    s.answer,
      updatedAt: s.updatedAt,
    })),
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}
