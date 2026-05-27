import { issueTokenPair, verifyAccessToken, verifyRefreshToken, issueAdminToken, verifyAdminToken } from '../jwt.service.js';
import { UserRole, AdminRole } from '@abroad-matrimony/shared';
import jwt from 'jsonwebtoken';

jest.mock('@abroad-matrimony/config', () => ({
  getEnv: () => ({
    JWT_ACCESS_SECRET:   'test_access_secret_at_least_32_chars_long_for_test',
    JWT_REFRESH_SECRET:  'test_refresh_secret_at_least_32_chars_long_for_test',
    ADMIN_JWT_SECRET:    'test_admin_secret_at_least_32_chars_long_for_test_x',
    JWT_ACCESS_EXPIRES_IN:  '15m',
    JWT_REFRESH_EXPIRES_IN: '30d',
    ADMIN_JWT_EXPIRES_IN:   '8h',
  }),
}));

const USER_ID = 'user-uuid-1234';
const DEVICE_ID = 'device-uuid-5678';

describe('issueTokenPair', () => {
  it('returns accessToken, refreshToken, tokenId, and expiresIn', () => {
    const result = issueTokenPair(USER_ID, UserRole.USER, DEVICE_ID);

    expect(result.accessToken).toBeTruthy();
    expect(result.refreshToken).toBeTruthy();
    expect(result.tokenId).toBeTruthy();
    expect(result.expiresIn).toBe(900);
  });

  it('access token contains correct sub, role, and deviceId claims', () => {
    const { accessToken } = issueTokenPair(USER_ID, UserRole.USER, DEVICE_ID);
    const decoded = jwt.decode(accessToken) as Record<string, unknown>;

    expect(decoded.sub).toBe(USER_ID);
    expect(decoded.role).toBe(UserRole.USER);
    expect(decoded.deviceId).toBe(DEVICE_ID);
  });

  it('refresh token contains sub, jti (tokenId), and deviceId claims', () => {
    const { refreshToken, tokenId } = issueTokenPair(USER_ID, UserRole.USER, DEVICE_ID);
    const decoded = jwt.decode(refreshToken) as Record<string, unknown>;

    expect(decoded.sub).toBe(USER_ID);
    expect(decoded.jti).toBe(tokenId);
    expect(decoded.deviceId).toBe(DEVICE_ID);
  });

  it('generates a unique tokenId on each call', () => {
    const a = issueTokenPair(USER_ID, UserRole.USER, DEVICE_ID);
    const b = issueTokenPair(USER_ID, UserRole.USER, DEVICE_ID);

    expect(a.tokenId).not.toBe(b.tokenId);
  });
});

describe('verifyAccessToken', () => {
  it('returns the payload for a valid token', () => {
    const { accessToken } = issueTokenPair(USER_ID, UserRole.USER, DEVICE_ID);
    const payload = verifyAccessToken(accessToken);

    expect(payload).not.toBeNull();
    expect(payload!.sub).toBe(USER_ID);
    expect(payload!.role).toBe(UserRole.USER);
  });

  it('returns null for a tampered token', () => {
    const { accessToken } = issueTokenPair(USER_ID, UserRole.USER, DEVICE_ID);
    const tampered = accessToken.slice(0, -5) + 'XXXXX';

    expect(verifyAccessToken(tampered)).toBeNull();
  });

  it('returns null for a token signed with wrong secret', () => {
    const wrongToken = jwt.sign({ sub: USER_ID }, 'wrong_secret');
    expect(verifyAccessToken(wrongToken)).toBeNull();
  });
});

describe('verifyRefreshToken', () => {
  it('returns the payload for a valid refresh token', () => {
    const { refreshToken, tokenId } = issueTokenPair(USER_ID, UserRole.USER, DEVICE_ID);
    const payload = verifyRefreshToken(refreshToken);

    expect(payload).not.toBeNull();
    expect(payload!.sub).toBe(USER_ID);
    expect(payload!.jti).toBe(tokenId);
  });

  it('returns null for a tampered refresh token', () => {
    const { refreshToken } = issueTokenPair(USER_ID, UserRole.USER, DEVICE_ID);
    expect(verifyRefreshToken(refreshToken + 'x')).toBeNull();
  });
});

// ── Admin JWT ──────────────────────────────────────────────────────────────

const ADMIN_ID    = 'admin-uuid-9999';
const ADMIN_EMAIL = 'admin@abroadmatrimony.com';

describe('issueAdminToken', () => {
  it('returns an accessToken and expiresIn of 28800 seconds', () => {
    const result = issueAdminToken(ADMIN_ID, AdminRole.SUPERADMIN, ADMIN_EMAIL);

    expect(result.accessToken).toBeTruthy();
    expect(result.expiresIn).toBe(28800);
  });

  it('token contains correct sub, role, and email claims', () => {
    const { accessToken } = issueAdminToken(ADMIN_ID, AdminRole.OPS, ADMIN_EMAIL);
    const decoded = jwt.decode(accessToken) as Record<string, unknown>;

    expect(decoded.sub).toBe(ADMIN_ID);
    expect(decoded.role).toBe(AdminRole.OPS);
    expect(decoded.email).toBe(ADMIN_EMAIL);
  });
});

describe('verifyAdminToken', () => {
  it('returns the payload for a valid admin token', () => {
    const { accessToken } = issueAdminToken(ADMIN_ID, AdminRole.SUPERADMIN, ADMIN_EMAIL);
    const payload = verifyAdminToken(accessToken);

    expect(payload).not.toBeNull();
    expect(payload!.sub).toBe(ADMIN_ID);
    expect(payload!.role).toBe(AdminRole.SUPERADMIN);
    expect(payload!.email).toBe(ADMIN_EMAIL);
  });

  it('returns null for a tampered admin token', () => {
    const { accessToken } = issueAdminToken(ADMIN_ID, AdminRole.SUPERADMIN, ADMIN_EMAIL);
    expect(verifyAdminToken(accessToken + 'x')).toBeNull();
  });

  it('returns null for a user token verified with the admin secret', () => {
    const { accessToken } = issueTokenPair(USER_ID, UserRole.USER, DEVICE_ID);
    expect(verifyAdminToken(accessToken)).toBeNull();
  });
});
