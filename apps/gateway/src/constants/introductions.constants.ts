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
