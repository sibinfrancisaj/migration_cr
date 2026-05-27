// Adapters
export { getOtpAdapter } from './adapters/index.js';
export type { OtpAdapter } from './adapters/index.js';
export { TwilioOtpAdapter } from './adapters/index.js';
export { MockOtpAdapter } from './adapters/index.js';

// Rate limiting
export { checkAndIncrOtpRateLimit } from './otp.rate-limit.js';
export type { RateLimitResult } from './otp.rate-limit.js';

// OTP service
export { verifyOtp } from './otp.service.js';

// JWT service
export { issueTokenPair, verifyAccessToken, verifyRefreshToken } from './jwt.service.js';
export type { TokenPairResult } from './jwt.service.js';

// Refresh token service
export {
  storeRefreshToken,
  getStoredRefreshToken,
  revokeToken,
  revokeAllForUser,
  hashToken,
} from './refresh-token.service.js';
export type { StoredRefreshToken } from './refresh-token.service.js';

// OTP verify service (orchestrator)
export { otpVerifyService, OtpInvalidError, DeviceLimitError } from './otp-verify.service.js';
export type { OtpVerifyInput, OtpVerifyResult } from './otp-verify.service.js';
