import type { EventHandler, EventHandlerRegistry } from '@abroad-matrimony/event-bus';
import { CLOUD_EVENT_TYPES, type VerificationReviewedEventData } from '@abroad-matrimony/shared';
import { recalculateCompletionScore } from './score.service.js';

export const COMPLETION_HANDLER_NAME = 'profile:recalculate-on-verification';

/**
 * VERIFICATION_REVIEWED → recompute completion score (verification is worth 10 points).
 * Idempotent: the score is derived from current DB state. The recalculation
 * publishes PROFILE_UPDATED, which in turn refreshes the user's match scores.
 */
export function createProfileEventHandlers(): EventHandlerRegistry {
  const recalculateOnVerification: EventHandler<VerificationReviewedEventData> = {
    name: COMPLETION_HANDLER_NAME,
    handle: async (event) => {
      await recalculateCompletionScore(event.data.userId);
    },
  };

  return {
    [CLOUD_EVENT_TYPES.VERIFICATION_REVIEWED]: [recalculateOnVerification as EventHandler],
  };
}
