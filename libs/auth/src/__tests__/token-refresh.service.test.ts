import { tokenRefreshService, TokenInvalidError, TokenReuseError } from '../token-refresh.service.js';
import { UserRole } from '@abroad-matrimony/shared';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockVerifyRefreshToken = jest.fn();
const mockIssueTokenPair = jest.fn();
const mockGetStoredRefreshToken = jest.fn();
const mockRevokeToken = jest.fn();
const mockRevokeAllForUser = jest.fn();
const mockStoreRefreshToken = jest.fn();

jest.mock('../jwt.service.js', () => ({
  verifyRefreshToken: (...args: unknown[]) => mockVerifyRefreshToken(...args),
  issueTokenPair: (...args: unknown[]) => mockIssueTokenPair(...args),
}));

jest.mock('../refresh-token.service.js', () => ({
  getStoredRefreshToken: (...args: unknown[]) => mockGetStoredRefreshToken(...args),
  revokeToken: (...args: unknown[]) => mockRevokeToken(...args),
  revokeAllForUser: (...args: unknown[]) => mockRevokeAllForUser(...args),
  storeRefreshToken: (...args: unknown[]) => mockStoreRefreshToken(...args),
}));

const mockUserFindUnique = jest.fn();

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
  },
}));

jest.mock('@abroad-matrimony/shared', () => ({
  CACHE_TTL: { REFRESH_TOKEN_SECONDS: 2592000 },
  UserRole: { USER: 'USER', VERIFIED: 'VERIFIED', FOUNDING_MEMBER: 'FOUNDING_MEMBER', SUSPENDED: 'SUSPENDED' },
}));

// ── Fixtures ──────────────────────────────────────────────────────────────

const USER_ID = 'user-uuid-1';
const DEVICE_ID = 'device-uuid-1';
const TOKEN_ID = 'token-uuid-old';
const NEW_TOKEN_ID = 'token-uuid-new';
const RAW_REFRESH_TOKEN = 'old.refresh.jwt';

const VALID_PAYLOAD = { sub: USER_ID, jti: TOKEN_ID, deviceId: DEVICE_ID };
const STORED_RECORD = { userId: USER_ID, deviceId: DEVICE_ID };
const DB_USER = { id: USER_ID, role: UserRole.USER };
const NEW_TOKEN_PAIR = {
  accessToken: 'new.access.jwt',
  refreshToken: 'new.refresh.jwt',
  tokenId: NEW_TOKEN_ID,
  expiresIn: 900,
};

// ── Tests ─────────────────────────────────────────────────────────────────

describe('tokenRefreshService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyRefreshToken.mockReturnValue(VALID_PAYLOAD);
    mockGetStoredRefreshToken.mockResolvedValue(STORED_RECORD);
    mockRevokeToken.mockResolvedValue(undefined);
    mockRevokeAllForUser.mockResolvedValue(undefined);
    mockUserFindUnique.mockResolvedValue(DB_USER);
    mockIssueTokenPair.mockReturnValue(NEW_TOKEN_PAIR);
    mockStoreRefreshToken.mockResolvedValue(undefined);
  });

  describe('happy path', () => {
    it('returns new accessToken, refreshToken, and expiresIn', async () => {
      const result = await tokenRefreshService({ refreshToken: RAW_REFRESH_TOKEN });

      expect(result.accessToken).toBe(NEW_TOKEN_PAIR.accessToken);
      expect(result.refreshToken).toBe(NEW_TOKEN_PAIR.refreshToken);
      expect(result.expiresIn).toBe(900);
    });

    it('revokes the old token before issuing a new pair', async () => {
      await tokenRefreshService({ refreshToken: RAW_REFRESH_TOKEN });

      expect(mockRevokeToken).toHaveBeenCalledWith(TOKEN_ID);
      expect(mockRevokeToken).toHaveBeenCalledTimes(1);
    });

    it('stores the new refresh token after issuing it', async () => {
      await tokenRefreshService({ refreshToken: RAW_REFRESH_TOKEN });

      expect(mockStoreRefreshToken).toHaveBeenCalledWith(
        NEW_TOKEN_ID,
        USER_ID,
        DEVICE_ID,
        NEW_TOKEN_PAIR.refreshToken,
        expect.any(Date),
      );
    });

    it('looks up user role from DB to issue tokens with current role', async () => {
      await tokenRefreshService({ refreshToken: RAW_REFRESH_TOKEN });

      expect(mockUserFindUnique).toHaveBeenCalledWith({
        where: { id: USER_ID },
        select: { id: true, role: true },
      });
      expect(mockIssueTokenPair).toHaveBeenCalledWith(USER_ID, DB_USER.role, DEVICE_ID);
    });

    it('issues token with updated role when user was promoted', async () => {
      mockUserFindUnique.mockResolvedValue({ id: USER_ID, role: UserRole.FOUNDING_MEMBER });

      await tokenRefreshService({ refreshToken: RAW_REFRESH_TOKEN });

      expect(mockIssueTokenPair).toHaveBeenCalledWith(USER_ID, UserRole.FOUNDING_MEMBER, DEVICE_ID);
    });
  });

  describe('error cases', () => {
    it('throws TokenInvalidError when JWT verification fails', async () => {
      mockVerifyRefreshToken.mockReturnValue(null);

      await expect(tokenRefreshService({ refreshToken: 'bad.token' })).rejects.toThrow(TokenInvalidError);
    });

    it('does not touch DB or Redis when JWT is invalid', async () => {
      mockVerifyRefreshToken.mockReturnValue(null);

      await expect(tokenRefreshService({ refreshToken: 'bad.token' })).rejects.toThrow(TokenInvalidError);
      expect(mockGetStoredRefreshToken).not.toHaveBeenCalled();
      expect(mockRevokeToken).not.toHaveBeenCalled();
      expect(mockUserFindUnique).not.toHaveBeenCalled();
    });

    it('throws TokenReuseError when stored token is not found (already revoked)', async () => {
      mockGetStoredRefreshToken.mockResolvedValue(null);

      await expect(tokenRefreshService({ refreshToken: RAW_REFRESH_TOKEN })).rejects.toThrow(TokenReuseError);
    });

    it('revokes ALL user sessions on reuse detection', async () => {
      mockGetStoredRefreshToken.mockResolvedValue(null);

      await expect(tokenRefreshService({ refreshToken: RAW_REFRESH_TOKEN })).rejects.toThrow(TokenReuseError);
      expect(mockRevokeAllForUser).toHaveBeenCalledWith(USER_ID);
    });

    it('does not issue new tokens on reuse detection', async () => {
      mockGetStoredRefreshToken.mockResolvedValue(null);

      await expect(tokenRefreshService({ refreshToken: RAW_REFRESH_TOKEN })).rejects.toThrow(TokenReuseError);
      expect(mockIssueTokenPair).not.toHaveBeenCalled();
      expect(mockStoreRefreshToken).not.toHaveBeenCalled();
    });

    it('throws TokenInvalidError when user no longer exists in DB', async () => {
      mockUserFindUnique.mockResolvedValue(null);

      await expect(tokenRefreshService({ refreshToken: RAW_REFRESH_TOKEN })).rejects.toThrow(TokenInvalidError);
    });

    it('still revokes the old token even when user is not found', async () => {
      mockUserFindUnique.mockResolvedValue(null);

      await expect(tokenRefreshService({ refreshToken: RAW_REFRESH_TOKEN })).rejects.toThrow(TokenInvalidError);
      expect(mockRevokeToken).toHaveBeenCalledWith(TOKEN_ID);
    });
  });
});
