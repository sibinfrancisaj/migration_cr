import type { EventHandler, EventHandlerRegistry } from '@abroad-matrimony/event-bus';
import { CLOUD_EVENT_TYPES, type ProfileUpdatedEventData } from '@abroad-matrimony/shared';
import { enqueueScoreRecompute } from './score-recompute.worker.js';

export const RECOMPUTE_HANDLER_NAME = 'matching:recompute-on-profile-update';

/**
 * PROFILE_UPDATED → debounced per-user score recompute (EVT-004).
 * Idempotent: the per-user jobId collapses repeat events into one job.
 */
export function createMatchingEventHandlers(redisUrl: string): EventHandlerRegistry {
  const recomputeOnProfileUpdate: EventHandler<ProfileUpdatedEventData> = {
    name: RECOMPUTE_HANDLER_NAME,
    handle: async (event) => {
      await enqueueScoreRecompute(redisUrl, { userId: event.data.userId, requestedBy: event.data.userId });
    },
  };

  return {
    [CLOUD_EVENT_TYPES.PROFILE_UPDATED]: [recomputeOnProfileUpdate as EventHandler],
  };
}
