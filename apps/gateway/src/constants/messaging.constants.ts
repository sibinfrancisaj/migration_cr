export const MESSAGING_ERRORS = {
  CONVERSATION_NOT_FOUND:      'Conversation not found.',
  CONVERSATION_FORBIDDEN:      'You are not a participant in this conversation.',
  CONVERSATION_ARCHIVED:       'This conversation has been archived and no longer accepts messages.',
  MESSAGE_NOT_FOUND:           'Message not found.',
  FIREBASE_NOT_CONFIGURED:     'Firebase is not configured on this server.',
} as const;

export const MESSAGING_MESSAGES = {
  CONVERSATIONS_LISTED:        'Conversations retrieved.',
  CONVERSATION_RETRIEVED:      'Conversation retrieved.',
  MESSAGES_RETRIEVED:          'Messages retrieved.',
  MESSAGE_SENT:                'Message sent.',
  UPLOAD_URL_GENERATED:        'Upload URL generated.',
  FIREBASE_TOKEN_ISSUED:       'Firebase custom token issued.',
  READ_RECEIPT_RECORDED:       'Read receipt recorded.',
} as const;

export const MESSAGING_LIMITS = {
  MAX_MESSAGES_PER_PAGE:       100,
  DEFAULT_MESSAGES_PER_PAGE:   50,
} as const;
