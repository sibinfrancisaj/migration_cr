import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';
import type { StoryPromptAnswerDto } from '@abroad-matrimony/shared';
import { StoryPromptKey } from '@abroad-matrimony/shared';
import { recalculateCompletionScore } from './score.service.js';
import { ProfileNotFoundError } from './real-life-answer.service.js';

const log = createChildLogger({ module: 'profile:story-prompt' });

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UpsertStoryPromptInput {
  userId:    string;
  promptKey: StoryPromptKey;
  answer:    string;
}

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * Creates or updates one of the 3 story prompt answers for a user.
 *
 * Flow:
 *   1. Verify the user has a profile.
 *   2. Upsert the story_prompt_answers row (unique: userId + promptKey).
 *   3. Recalculate and persist the profile completion score.
 *
 * @throws {ProfileNotFoundError} if the user has no profile yet
 */
export async function upsertStoryPrompt(
  input: UpsertStoryPromptInput,
): Promise<StoryPromptAnswerDto> {
  const { userId, promptKey, answer } = input;

  // 1. Guard: profile must exist before answers can be saved.
  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile) {
    log.warn('upsertStoryPrompt blocked — no profile for user', { userId });
    throw new ProfileNotFoundError();
  }

  // 2. Upsert — unique constraint is (userId, promptKey).
  const storyAnswer = await prisma.storyPromptAnswer.upsert({
    where:  { userId_promptKey: { userId, promptKey } },
    create: { userId, promptKey, answer },
    update: { answer },
  });

  log.info('Story prompt answer upserted', { userId, promptKey });

  // 3. Recalculate completion score (fire-and-await — ensures DB is consistent).
  await recalculateCompletionScore(userId);

  return {
    promptKey: storyAnswer.promptKey as StoryPromptKey,
    answer:    storyAnswer.answer,
    updatedAt: storyAnswer.updatedAt,
  };
}
