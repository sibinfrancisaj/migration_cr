export const OTP_EXPIRY_SECONDS = 600; // Twilio Verify default expiry

export const AUTH_ERRORS = {
  OTP_RATE_LIMITED: 'Too many OTP requests. Please try again later.',
  OTP_SEND_FAILED: 'Failed to send OTP. Please try again.',
  OTP_INVALID: 'Invalid or expired OTP.',
  OTP_ALREADY_VERIFIED: 'Phone number is already verified.',
  TOKEN_INVALID: 'Invalid or expired token.',
  TOKEN_REUSE_DETECTED: 'Token reuse detected. All sessions invalidated.',
  UNAUTHORIZED: 'Authentication required.',
  FORBIDDEN: 'Insufficient permissions.',
  DEVICE_LIMIT_EXCEEDED: 'Maximum device limit reached. Log out from another device first.',
  DEVICE_NOT_TRUSTED: 'Device not recognised or trust has expired. Please verify via OTP.',
  TRUSTED_DEVICE_RATE_LIMITED: 'Too many attempts. Please try again later.',
} as const;

export const AUTH_MESSAGES = {
  OTP_SENT: 'OTP sent successfully.',
  OTP_VERIFIED: 'Phone verified successfully.',
  TOKEN_REFRESHED: 'Token refreshed successfully.',
  LOGGED_OUT: 'Logged out successfully.',
  TRUSTED_DEVICE_LOGIN: 'Trusted device login successful.',
} as const;
