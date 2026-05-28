export const FLAG_ERRORS = {
  MESSAGE_NOT_FOUND:   'Message not found.',
  ALREADY_FLAGGED:     'You have already flagged this message.',
  FLAG_SELF:           'You cannot flag your own message.',
  FLAG_NOT_FOUND:      'Flag not found.',
} as const;

export const FLAG_MESSAGES = {
  FLAG_CREATED:    'Message reported for moderation.',
  FLAGS_RETRIEVED: 'Flags retrieved.',
  FLAG_RESOLVED:   'Flag resolved.',
} as const;
