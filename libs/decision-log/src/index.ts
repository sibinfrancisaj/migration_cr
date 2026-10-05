// Write path (fire-and-forget helpers)
export {
  logMatchScoreComputed,
  logMatchScoreUpdated,
  logDiscoveryFeedGenerated,
  logImplicitSignalApplied,
  logIntroPairingCreated,
  logIntroDropReleased,
  logTuningApplied,
  logNotificationQueued,
  pruneOldDecisionLogs,
} from './decision-log.service.js';

// Read path (admin queries)
export {
  queryDecisionLogs,
  getMatchStory,
  getUserTimeline,
} from './decision-log-query.service.js';

// Types
export type {
  DecisionLogEventType,
  DecisionLogConfidence,
  DecisionLogDto,
  DecisionLogQueryParams,
  MatchStoryDto,
  MatchStoryEntry,
  MatchScoreLogData,
  DiscoveryFeedLogData,
  ImplicitSignalLogData,
  IntroPairingLogData,
  IntroDropReleasedLogData,
  TuningAppliedLogData,
  NotificationQueuedLogData,
  LogDecisionParams,
} from './types/decision-log.types.js';

export { DecisionLogEventType, DecisionLogConfidence } from './types/decision-log.types.js';
