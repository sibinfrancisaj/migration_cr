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
  revokeForDevice,
  revokeAllForUser,
  hashToken,
} from './refresh-token.service.js';
export type { StoredRefreshToken } from './refresh-token.service.js';

// OTP verify service (orchestrator)
export { otpVerifyService, OtpInvalidError, DeviceLimitError } from './otp-verify.service.js';
export type { OtpVerifyInput, OtpVerifyResult } from './otp-verify.service.js';

// Token refresh service (one-time rotation + reuse detection)
export { tokenRefreshService, TokenInvalidError, TokenReuseError } from './token-refresh.service.js';
export type { TokenRefreshInput, TokenRefreshResult } from './token-refresh.service.js';

// requireAuth middleware (used by gateway + admin-api)
export { requireAuth } from './middleware/require-auth.middleware.js';

// requireRole — user RBAC (must follow requireAuth in middleware chain)
export { requireRole } from './middleware/require-role.middleware.js';

// requireAdminRole — admin RBAC (reads + verifies admin JWT, optional role list)
export { requireAdminRole } from './middleware/require-admin-role.middleware.js';

// auditLog — write an immutable admin audit trail entry
export { auditLog } from './audit.service.js';
export type { AuditLogInput } from './audit.service.js';

// Admin JWT
export { issueAdminToken, verifyAdminToken } from './jwt.service.js';
export type { AdminTokenResult } from './jwt.service.js';

// Admin rate-limit
export { checkAdminLoginRateLimit } from './admin.rate-limit.js';
export type { AdminRateLimitResult } from './admin.rate-limit.js';

// Admin auth service
export {
  adminLoginService,
  AdminCredentialsError,
  AdminTotpRequiredError,
  AdminTotpInvalidError,
} from './admin-auth.service.js';
export type { AdminLoginInput, AdminLoginResult } from './admin-auth.service.js';
