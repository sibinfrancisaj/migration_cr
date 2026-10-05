/**
 * Seeder auth token builder for E2E tests.
 *
 * Mirrors the format from apps/seeder/src/lib/seeder-token.ts and
 * apps/gateway/src/middleware/seeder-auth.middleware.ts (ADR-014).
 *
 * Token: `<SEEDER_SECRET>.<base64url-encoded-JSON>`
 *
 * The gateway's seederAuthMiddleware accepts this token and sets req.user
 * without requiring a real JWT or OTP flow — non-production only.
 */

export interface SeederTokenPayload {
  userId: string;
  role: string;
  deviceId?: string;
}

export function buildSeederToken(secret: string, payload: SeederTokenPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${secret}.${encoded}`;
}

export function makeAuthHeader(secret: string, userId: string, role = 'MEMBER'): string {
  const token = buildSeederToken(secret, { userId, role, deviceId: 'e2e-device' });
  return `Bearer ${token}`;
}

export function makeAdminAuthHeader(secret: string, adminUserId: string): string {
  return makeAuthHeader(secret, adminUserId, 'SUPERADMIN');
}
