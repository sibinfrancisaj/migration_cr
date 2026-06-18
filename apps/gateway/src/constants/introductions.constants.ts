export const INTRODUCTION_ERRORS = {
  NOT_FOUND: 'Introduction not found',
  FORBIDDEN: 'Not your introduction',
  EXPIRED: 'Introduction has expired',
  ALREADY_RESPONDED: 'Already responded to this introduction',
} as const;

export const INTRODUCTION_MESSAGES = {
  ACCEPTED: 'Introduction accepted',
  DECLINED: 'Introduction declined',
} as const;

// ─── IntroductionDrop ─────────────────────────────────────────────────────────

export const DROP_ERRORS = {
  NOT_FOUND: 'Introduction drop not found',
  NOT_LIVE: 'This drop is not currently accessible',
  INSUFFICIENT_DIAMONDS: 'Insufficient diamonds for this action',
  ALREADY_UNLOCKED: 'You have already unlocked this drop',
} as const;

export const DROP_MESSAGES = {
  EARLY_ACCESS_GRANTED: 'Early access granted',
  DROP_UNLOCKED: 'Drop unlocked successfully',
} as const;

// ─── Phase 10: Early Unlock + Match Context ───────────────────────────────────

export const EARLY_UNLOCK_ERRORS = {
  INSUFFICIENT_DIAMONDS: 'Insufficient diamonds to unlock early',
} as const;

export const EARLY_UNLOCK_MESSAGES = {
  UNLOCKED:         'Weekly introductions unlocked early',
  ALREADY_UNLOCKED: 'Already unlocked this week',
} as const;

export const MATCH_CONTEXT_ERRORS = {
  PROFILE_NOT_FOUND: 'Profile not found',
  CANNOT_SELF_MATCH: 'Cannot view match context with yourself',
} as const;
