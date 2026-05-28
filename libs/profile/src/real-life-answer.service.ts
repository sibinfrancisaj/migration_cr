import { prisma, Prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';
import type { RealLifeAnswerDto } from '@abroad-matrimony/shared';
import { RealLifeQuestionKey } from '@abroad-matrimony/shared';
import { recalculateCompletionScore } from './score.service.js';

const log = createChildLogger({ module: 'profile:real-life-answer' });

// ── Custom errors ─────────────────────────────────────────────────────────────

/**
 * Thrown when the target user has no profile row.
 * Users must call POST /api/v1/profile before answering questions.
 */
export class ProfileNotFoundError extends Error {
  constructor() {
    super('PROFILE_NOT_FOUND');
    this.name = 'ProfileNotFoundError';
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UpsertRealLifeAnswerInput {
  userId:      string;
  questionKey: RealLifeQuestionKey;
  value:       string | string[];
}

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * Creates or updates one of the 12 real-life answers for a user.
 *
 * Flow:
 *   1. Verify the user has a profile (profiles.userId is unique).
 *   2. Upsert the real_life_answers row.
 *   3. Recalculate and persist the profile completion score.
 *
 * @throws {ProfileNotFoundError} if the user has no profile yet
 */
export async function upsertRealLifeAnswer(
  input: UpsertRealLifeAnswerInput,
): Promise<RealLifeAnswerDto> {
  const { userId, questionKey, value } = input;

  // 1. Guard: profile must exist before answers can be saved.
  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile) {
    log.warn('upsertRealLifeAnswer blocked — no profile for user', { userId });
    throw new ProfileNotFoundError();
  }

  // 2. Upsert — unique constraint is (userId, questionKey).
  const answer = await prisma.realLifeAnswer.upsert({
    where:  { userId_questionKey: { userId, questionKey } },
    create: { userId, questionKey, value: value as Prisma.InputJsonValue },
    update: { value: value as Prisma.InputJsonValue },
  });

  log.info('Real-life answer upserted', { userId, questionKey });

  // 3. Recalculate completion score (fire-and-await — ensures DB is consistent).
  await recalculateCompletionScore(userId);

  return {
    questionKey: answer.questionKey as RealLifeQuestionKey,
    value: answer.value as string | string[],
    updatedAt: answer.updatedAt,
  };
}
