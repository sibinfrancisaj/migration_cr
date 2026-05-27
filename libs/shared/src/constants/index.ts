export const QUEUE_NAMES = {
  EVENTS: 'events',
  MATCHING: 'matching',
  NOTIFICATION: 'notification',
  PAYMENT: 'payment',
  CLEANUP: 'cleanup',
} as const;

export const CACHE_KEYS = {
  FEATURE_FLAG: (key: string) => `am:ff:${key}`,
  USER_PROFILE: (userId: string) => `am:profile:${userId}`,
  MATCH_SCORES: (userId: string) => `am:scores:${userId}`,
  REFRESH_TOKEN: (tokenId: string) => `am:rt:${tokenId}`,
  OTP_ATTEMPTS: (phone: string) => `am:otp:attempts:${phone}`,
  RATE_LIMIT: (key: string) => `am:rl:${key}`,
} as const;

export const CACHE_TTL = {
  FEATURE_FLAG_SECONDS: 300,
  USER_PROFILE_SECONDS: 600,
  MATCH_SCORES_SECONDS: 86400,
  REFRESH_TOKEN_SECONDS: 30 * 24 * 60 * 60,
} as const;

export const CLOUD_EVENT_TYPES = {
  USER_REGISTERED: 'com.abroadmatrimony.user.registered',
  USER_VERIFIED: 'com.abroadmatrimony.user.verified',
  USER_SUSPENDED: 'com.abroadmatrimony.user.suspended',
  PROFILE_UPDATED: 'com.abroadmatrimony.profile.updated',
  PROFILE_COMPLETED: 'com.abroadmatrimony.profile.completed',
  CONNECTION_SENT: 'com.abroadmatrimony.connection.sent',
  CONNECTION_ACCEPTED: 'com.abroadmatrimony.connection.accepted',
  MATCH_CREATED: 'com.abroadmatrimony.match.created',
  MESSAGE_SENT: 'com.abroadmatrimony.message.sent',
  CHECK_IN_SUBMITTED: 'com.abroadmatrimony.checkin.submitted',
  GROUP_INTRO_DROP: 'com.abroadmatrimony.group.introdrop',
  VERIFICATION_SUBMITTED: 'com.abroadmatrimony.verification.submitted',
  VERIFICATION_REVIEWED: 'com.abroadmatrimony.verification.reviewed',
  PAYMENT_SUCCEEDED: 'com.abroadmatrimony.payment.succeeded',
  PAYMENT_FAILED: 'com.abroadmatrimony.payment.failed',
  MEMBERSHIP_ACTIVATED: 'com.abroadmatrimony.membership.activated',
  MEMBERSHIP_EXPIRED: 'com.abroadmatrimony.membership.expired',
  SCORE_RECOMPUTE_REQUESTED: 'com.abroadmatrimony.matching.recompute',
} as const;

export const CLOUD_EVENT_SOURCE = 'abroad-matrimony-api';

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

export const REAL_LIFE_QUESTIONS_TOTAL = 12;
export const STORY_PROMPTS_TOTAL = 3;
export const MIN_PROFILE_PHOTOS = 1;
export const MAX_PROFILE_PHOTOS = 6;
export const MIN_OTP_DIGITS = 6;
export const MAX_DEVICES_PER_USER = 5;
export const SCORE_RECOMPUTE_STALE_HOURS = 24;
