// Pure scoring algorithm
export {
  computeMatchScore, SCORE_WEIGHTS, HABIT_WEIGHTS, PROMPT_RESONANCE_WEIGHT, V2_DIM_WEIGHTS,
  applyTuningToBreakdown,
  tokenize, jaccardSimilarity, answerSimilarity, recencyScore, ageInYears,
} from './scoring.service.js';
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

// Match tuning
export {
  getMatchTuning, setMatchTuning,
  getTuningAsQuestions, setTuningFromQuestions, computeTuningImpact,
  importanceToMultiplier, multiplierToImportance,
} from './match-tuning.service.js';
export type {
  MatchTuningDto, MatchWeights,
  TuningQuestionsDto, TuningImpactDto,
} from './match-tuning.service.js';
