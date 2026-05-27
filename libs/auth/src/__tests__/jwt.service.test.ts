import { issueTokenPair, verifyAccessToken, verifyRefreshToken } from '../jwt.service.js';
import { UserRole } from '@abroad-matrimony/shared';
import jwt from 'jsonwebtoken';

jest.mock('@abroad-matrimony/config', () => ({
  getEnv: () => ({
    JWT_ACCESS_SECRET: 'test_access_secret_at_least_32_chars_long_for_test',
    JWT_REFRESH_SECRET: 'test_refresh_secret_at_least_32_chars_long_for_test',
    JWT_ACCESS_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '30d',
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
