export const DECISION_LOG_ERRORS = {
  NOT_FOUND:           'Decision log entry not found.',
  INVALID_EVENT_TYPE:  'Invalid event type filter.',
  MISSING_USER_PARAM:  'userA and userB query parameters are required.',
  MISSING_USER_ID:     'userId query parameter is required.',
} as const;

export const DECISION_LOG_MESSAGES = {
  LIST_OK:       'Decision logs retrieved.',
  MATCH_STORY_OK: 'Match story retrieved.',
  TIMELINE_OK:   'User decision timeline retrieved.',
} as const;
