/**
 * AI-007 — Profile Intelligence Job Enqueue Helper.
 *
 * Enqueues a PROFILE_INTELLIGENCE_UPDATE job with a 60-second debounce.
 * BullMQ's `jobId` uniqueness is used: if a job with the same ID is already
 * waiting, it is replaced (delay reset to 60s) rather than duplicated.
 *
 * Call this from any service that modifies profile signals:
 *   profile created/updated, real-life answers, story prompts, habits,
 *   weekly prompt responses, voice intro saved, match tuning updated.
 */
import { Queue } from 'bullmq';
import { createChildLogger } from '@abroad-matrimony/logger';
import { QUEUE_NAMES } from '@abroad-matrimony/shared';
import type { ProfileIntelligenceJobData } from './types/ai.types.js';

const log = createChildLogger({ module: 'ai:enqueue' });

/** Debounce delay in milliseconds — resets each time the same userId is updated. */
const DEBOUNCE_MS = 60_000;

/**
 * Enqueues (or replaces) a PROFILE_INTELLIGENCE_UPDATE job for the given user.
 *
 * Uses a stable jobId (`pi:${userId}`) so BullMQ deduplicates concurrent updates.
 * The 60s delay is reset on each call, giving the user a grace period to finish
 * editing before the AI regeneration fires.
 *
 * @param userId   The user whose profile intelligence needs updating.
 * @param redisUrl Redis connection URL (from env.REDIS_URL).
 */
export async function enqueueProfileIntelligence(
  userId: string,
  redisUrl: string,
): Promise<void> {
  const queue = new Queue<ProfileIntelligenceJobData>(QUEUE_NAMES.PROFILE_INTELLIGENCE, {
    connection: { url: redisUrl },
  });

  try {
    const jobId = `pi:${userId}`;

    // Remove any existing waiting job for this user so we reset the debounce timer.
    const existing = await queue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state === 'delayed' || state === 'waiting') {
        await existing.remove();
      }
    }

    await queue.add(
      'profile-intelligence',
      { userId },
      {
        jobId,
        delay: DEBOUNCE_MS,
        attempts: 3,
        backoff: { type: 'exponential', delay: 10_000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 100 },
      },
    );

    log.info('enqueueProfileIntelligence — job enqueued', { userId, debounceMs: DEBOUNCE_MS });
  } finally {
    await queue.close();
  }
}
