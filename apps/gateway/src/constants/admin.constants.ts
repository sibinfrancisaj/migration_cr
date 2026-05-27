export const ADMIN_ERRORS = {
  INVALID_CREDENTIALS: 'Invalid email or password.',
  TOTP_REQUIRED: 'Two-factor authentication code is required.',
  TOTP_INVALID: 'Invalid two-factor authentication code.',
  RATE_LIMITED: 'Too many login attempts. Please try again later.',
} as const;

export const ADMIN_MESSAGES = {
  LOGIN_SUCCESS: 'Login successful.',
} as const;
