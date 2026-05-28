import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';
import { MediaType, VerificationStatus } from '@abroad-matrimony/shared';

const log = createChildLogger({ module: 'profile:score' });

// ── Score weights ─────────────────────────────────────────────────────────────

const SCORE_WEIGHTS = {
  BASICS:              20, // profile exists with all required fields
  REAL_LIFE_ANSWERS:   40, // spread evenly across 12 questions
  STORY_PROMPTS:       20, // spread evenly across 3 prompts
  PHOTOS:              10, // at least 1 photo in the media table
  VERIFICATION:        10, // verificationStatus === APPROVED
} as const;

const TOTAL_RL_QUESTIONS  = 12;
const TOTAL_STORY_PROMPTS = 3;

/**
 * Recomputes and persists the profile completion score for a user.
 *
 * Score breakdown (100 points total):
 *   - Basics (name, DOB, gender, city, country, intent) = 20 pts (fixed on profile creation)
 *   - Real-life answers = up to 40 pts (pro-rated by answered / 12)
 *   - Story prompts = up to 20 pts (pro-rated by answered / 3)
 *   - At least 1 photo = 10 pts
 *   - Identity verified = 10 pts
 *
 * Called after: profile create, real-life answer upsert, story prompt upsert,
 * media upload, and verification status change.
 *
 * @returns the updated score (0–100), or 0 if the user has no profile yet
 */
export async function recalculateCompletionScore(userId: string): Promise<number> {
  const [profile, rlCount, storyCount, photoCount] = await Promise.all([
    prisma.profile.findUnique({
      where: { userId },
      select: { verificationStatus: true },
    }),
    prisma.realLifeAnswer.count({ where: { userId } }),
    prisma.storyPromptAnswer.count({ where: { userId } }),
    prisma.media.count({ where: { userId, type: MediaType.PHOTO } }),
  ]);

  if (!profile) {
    log.warn('recalculateCompletionScore called but no profile found', { userId });
    return 0;
  }

  const score = Math.round(
    SCORE_WEIGHTS.BASICS +
    (rlCount    / TOTAL_RL_QUESTIONS)  * SCORE_WEIGHTS.REAL_LIFE_ANSWERS +
    (storyCount / TOTAL_STORY_PROMPTS) * SCORE_WEIGHTS.STORY_PROMPTS +
    (photoCount >= 1 ? SCORE_WEIGHTS.PHOTOS : 0) +
    (profile.verificationStatus === VerificationStatus.APPROVED ? SCORE_WEIGHTS.VERIFICATION : 0),
  );

  await prisma.profile.update({
    where: { userId },
    data: { completionScore: score },
  });

  log.info('Completion score updated', { userId, score });
  return score;
}
