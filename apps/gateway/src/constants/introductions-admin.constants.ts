export const INTRO_ADMIN_ERRORS = {
  NOT_FOUND:    'Introduction drop not found',
  NOT_DRAFT:    'Drop must be in DRAFT status to approve',
  NOT_EDITABLE: 'Drop cannot be edited in its current status',
  POOL_TOO_SMALL: 'Member pool must contain at least 2 users',
} as const;

export const INTRO_ADMIN_MESSAGES = {
  DROP_PROPOSED:   'Introduction drop created as DRAFT',
  DROP_APPROVED:   'Drop approved — pairing generation started',
  MEMBERS_UPDATED: 'Member pool updated',
  DROP_SCHEDULED:  'Drop release time updated',
} as const;
