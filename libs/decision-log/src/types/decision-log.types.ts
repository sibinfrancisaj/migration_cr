import type { ScoreBreakdown } from '@abroad-matrimony/shared';

// ── Event types (mirror Prisma enum) ─────────────────────────────────────────

export const DecisionLogEventType = {
  MATCH_SCORE_COMPUTED:       'MATCH_SCORE_COMPUTED',
  MATCH_SCORE_UPDATED:        'MATCH_SCORE_UPDATED',
  DISCOVERY_FEED_GENERATED:   'DISCOVERY_FEED_GENERATED',
  IMPLICIT_SIGNAL_APPLIED:    'IMPLICIT_SIGNAL_APPLIED',
  TUNING_APPLIED:             'TUNING_APPLIED',
  INTRO_DROP_RELEASED:        'INTRO_DROP_RELEASED',
  INTRO_PAIRING_CREATED:      'INTRO_PAIRING_CREATED',
  COLLABORATIVE_FILTER_RUN:   'COLLABORATIVE_FILTER_RUN',
  MMR_RERANK_APPLIED:         'MMR_RERANK_APPLIED',
  SCORE_RECOMPUTE_TRIGGERED:  'SCORE_RECOMPUTE_TRIGGERED',
  NOTIFICATION_QUEUED:        'NOTIFICATION_QUEUED',
  PARTNER_PREF_FILTER_APPLIED: 'PARTNER_PREF_FILTER_APPLIED',
} as const;

export type DecisionLogEventType = typeof DecisionLogEventType[keyof typeof DecisionLogEventType];

export const DecisionLogConfidence = {
  HIGH:   'HIGH',
  MEDIUM: 'MEDIUM',
  LOW:    'LOW',
} as const;

export type DecisionLogConfidence = typeof DecisionLogConfidence[keyof typeof DecisionLogConfidence];

// ── Structured data payloads per event type ───────────────────────────────────

export interface MatchScoreLogData {
  userAId:          string;
  userBId:          string;
  totalScore:       number;
  breakdown:        ScoreBreakdown;
  implicitBoost:    number;
  coreScale:        number;
  optionalDims:     string[];
  algorithmVersion: string;
}

export interface DiscoveryFeedLogData {
  userId:              string;
  candidateCount:      number;
  finalCount:          number;
  rrfActive:           boolean;
  annColdStart:        boolean;
  collaborativeActive: boolean;
  mmrActive:           boolean;
  topScores:           number[];
  cursorUsed:          boolean;
}

export interface ImplicitSignalLogData {
  signalUserId:  string;
  targetUserId:  string;
  signal:        string;
  delta:         number;
  previousBoost: number;
  newBoost:      number;
  cumulativeDir: 'positive' | 'negative' | 'neutral';
}

export interface IntroPairingLogData {
  dropId:       string;
  recipientId:  string;
  matchedUserId: string;
  algorithm:    'pgvector' | 'match-score' | 'random';
  score:        number;
  pairingRank:  number;
}

export interface IntroDropReleasedLogData {
  dropId:       string;
  dropName:     string;
  memberCount:  number;
  pairingCount: number;
  releaseAt:    string;
  isWeeklyDrop: boolean;
}

export interface TuningAppliedLogData {
  userId:                string;
  settlementImportance?: number;
  familyImportance?:     number;
  topRankChanges:        Array<{ userId: string; oldRank: number; newRank: number }>;
}

export interface NotificationQueuedLogData {
  userId:          string;
  notificationType: string;
  channel:         string;
  deferredSeconds?: number;
  reason?:         string;
}

// ── Generic write params ──────────────────────────────────────────────────────

export interface LogDecisionParams {
  actorUserId:  string;
  targetUserId?: string;
  eventType:    DecisionLogEventType;
  summary:      string;
  data:         Record<string, unknown>;
  sessionId?:   string;
  confidence?:  DecisionLogConfidence;
}

// ── Read/query types ──────────────────────────────────────────────────────────

export interface DecisionLogDto {
  id:           string;
  actorUserId:  string;
  targetUserId: string | null;
  eventType:    DecisionLogEventType;
  summary:      string;
  narrative:    string | null;
  data:         Record<string, unknown>;
  sessionId:    string | null;
  confidence:   DecisionLogConfidence;
  createdAt:    Date;
}

export interface DecisionLogQueryParams {
  actorUserId?:  string;
  targetUserId?: string;
  eventType?:    DecisionLogEventType;
  from?:         Date;
  to?:           Date;
  sessionId?:    string;
  limit?:        number;
  page?:         number;
}

export interface MatchStoryEntry {
  timestamp:   Date;
  eventType:   DecisionLogEventType;
  summary:     string;
  narrative:   string | null;
  data:        Record<string, unknown>;
}

export interface MatchStoryDto {
  userAId:     string;
  userBId:     string;
  entries:     MatchStoryEntry[];
  currentScore: number | null;
}
