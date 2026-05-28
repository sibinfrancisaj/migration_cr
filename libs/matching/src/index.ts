// Pure scoring algorithm
export { computeMatchScore, SCORE_WEIGHTS, tokenize, jaccardSimilarity, answerSimilarity, recencyScore, ageInYears } from './scoring.service.js';
export type { UserScoringData, ScoreResult } from './scoring.service.js';

// DB persistence + orchestration
export { computeAndSaveScore, getUserScoringData, UserProfileMissingError, ALGORITHM_VERSION } from './match-score.service.js';

// BullMQ batch worker
export { processScoreRecompute, createScoreRecomputeWorker, enqueueScoreRecompute } from './score-recompute.worker.js';
export type { ScoreRecomputeJobData, ScoreRecomputeResult } from './score-recompute.worker.js';

// Redis cache
export { getMatchScore, setMatchScoreCache, deleteMatchScoreCache } from './score-cache.service.js';

// Discovery feed
export { getDiscoveryFeed, encodeCursor, decodeCursor, computeAge } from './discover.service.js';
export type { DiscoverOptions } from './discover.service.js';
