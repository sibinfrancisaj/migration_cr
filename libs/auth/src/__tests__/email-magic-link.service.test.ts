import {
  sendMagicLink,
  verifyMagicLink,
  MagicLinkUserNotFoundError,
  MagicLinkInvalidError,
} from '../email-magic-link.service.js';
import { UserRole } from '@abroad-matrimony/shared';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockUserFindUnique        = jest.fn();
const mockUserFindUniqueOrThrow = jest.fn();
const mockUserUpdate            = jest.fn();
const mockEmailMagicLinkDeleteMany = jest.fn();
const mockEmailMagicLinkCreate  = jest.fn();
const mockEmailMagicLinkFindUnique = jest.fn();
const mockEmailMagicLinkUpdate  = jest.fn();
const mockIssueTokenPair        = jest.fn();
const mockStoreRefreshToken     = jest.fn();

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    user: {
      findUnique:          (...a: unknown[]) => mockUserFindUnique(...a),
      findUniqueOrThrow:   (...a: unknown[]) => mockUserFindUniqueOrThrow(...a),
      update:              (...a: unknown[]) => mockUserUpdate(...a),
    },
    emailMagicLink: {
      deleteMany:  (...a: unknown[]) => mockEmailMagicLinkDeleteMany(...a),
      create:      (...a: unknown[]) => mockEmailMagicLinkCreate(...a),
      findUnique:  (...a: unknown[]) => mockEmailMagicLinkFindUnique(...a),
      update:      (...a: unknown[]) => mockEmailMagicLinkUpdate(...a),
    },
  },
}));

jest.mock('../jwt.service.js', () => ({
  issueTokenPair: (...a: unknown[]) => mockIssueTokenPair(...a),
}));

jest.mock('../refresh-token.service.js', () => ({
  storeRefreshToken: (...a: unknown[]) => mockStoreRefreshToken(...a),
}));

// ── Fixtures ───────────────────────────────────────────────────────────────────

const USER_ID   = 'user-uuid-1';
const EMAIL     = 'test@example.com';
const DEVICE_ID = 'device-uuid-1';

const USER_ROW = {
  id:              USER_ID,
  phone:           '+919876543210',
  email:           EMAIL,
  role:            UserRole.USER,
  isPhoneVerified: true,
  isEmailVerified: true,
  createdAt:       new Date('2026-05-01T10:00:00Z'),
};

const TOKEN_PAIR = {
  accessToken:  'mock.access.token',
  refreshToken: 'mock.refresh.token',
  tokenId:      'token-id-uuid',
  expiresIn:    900,
};

// ── sendMagicLink ──────────────────────────────────────────────────────────────

describe('sendMagicLink', () => {
  const originalEnv = process.env['NODE_ENV'];

  beforeEach(() => jest.clearAllMocks());

  afterAll(() => {
    process.env['NODE_ENV'] = originalEnv;
  });

  it('creates a magic link token and returns devToken in non-production', async () => {
    process.env['NODE_ENV'] = 'test';
    mockUserFindUnique.mockResolvedValue({ id: USER_ID, isEmailVerified: true });
    mockEmailMagicLinkDeleteMany.mockResolvedValue({});
    mockEmailMagicLinkCreate.mockResolvedValue({ id: 'link-1' });

    const result = await sendMagicLink(EMAIL);

    expect(mockEmailMagicLinkDeleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER_ID, usedAt: null } }),
    );
    expect(mockEmailMagicLinkCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: USER_ID, email: EMAIL }),
      }),
    );
    expect(typeof result.devToken).toBe('string');
    expect(result.devToken).toHaveLength(64); // 32 bytes as hex = 64 chars
  });

  it('does NOT return devToken in production', async () => {
    process.env['NODE_ENV'] = 'production';
    mockUserFindUnique.mockResolvedValue({ id: USER_ID, isEmailVerified: true });
    mockEmailMagicLinkDeleteMany.mockResolvedValue({});
    mockEmailMagicLinkCreate.mockResolvedValue({ id: 'link-1' });

    const result = await sendMagicLink(EMAIL);
    expect(result.devToken).toBeUndefined();
  });

  it('throws MagicLinkUserNotFoundError when user does not exist', async () => {
    process.env['NODE_ENV'] = 'test';
    mockUserFindUnique.mockResolvedValue(null);

    await expect(sendMagicLink(EMAIL)).rejects.toBeInstanceOf(MagicLinkUserNotFoundError);
    expect(mockEmailMagicLinkCreate).not.toHaveBeenCalled();
  });

  it('throws MagicLinkUserNotFoundError when email is not verified', async () => {
    process.env['NODE_ENV'] = 'test';
    mockUserFindUnique.mockResolvedValue({ id: USER_ID, isEmailVerified: false });

    await expect(sendMagicLink(EMAIL)).rejects.toBeInstanceOf(MagicLinkUserNotFoundError);
    expect(mockEmailMagicLinkCreate).not.toHaveBeenCalled();
  });
});

// ── verifyMagicLink ────────────────────────────────────────────────────────────

describe('verifyMagicLink', () => {
  beforeEach(() => jest.clearAllMocks());

  const rawToken = 'a'.repeat(64);
  const futureDate = new Date(Date.now() + 10 * 60 * 1000);

  const MAGIC_LINK_ROW = {
    id:       'link-1',
    userId:   USER_ID,
    expiresAt: futureDate,
    usedAt:   null,
  };

  beforeEach(() => {
    mockIssueTokenPair.mockReturnValue(TOKEN_PAIR);
    mockStoreRefreshToken.mockResolvedValue({});
    mockUserUpdate.mockResolvedValue({});
    mockUserFindUniqueOrThrow.mockResolvedValue(USER_ROW);
    mockEmailMagicLinkUpdate.mockResolvedValue({});
  });

  it('verifies a valid token and returns a JWT pair', async () => {
    mockEmailMagicLinkFindUnique.mockResolvedValue(MAGIC_LINK_ROW);

    const result = await verifyMagicLink(rawToken, DEVICE_ID);

    expect(mockEmailMagicLinkUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ usedAt: expect.any(Date) }) }),
    );
    expect(mockUserUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isEmailVerified: true } }),
    );
    expect(result.accessToken).toBe(TOKEN_PAIR.accessToken);
    expect(result.refreshToken).toBe(TOKEN_PAIR.refreshToken);
    expect(result.user.id).toBe(USER_ID);
  });

  it('throws MagicLinkInvalidError when token does not exist', async () => {
    mockEmailMagicLinkFindUnique.mockResolvedValue(null);

    await expect(verifyMagicLink(rawToken, DEVICE_ID)).rejects.toBeInstanceOf(MagicLinkInvalidError);
    expect(mockIssueTokenPair).not.toHaveBeenCalled();
  });

  it('throws MagicLinkInvalidError when token is already used', async () => {
    mockEmailMagicLinkFindUnique.mockResolvedValue({
      ...MAGIC_LINK_ROW,
      usedAt: new Date(),
    });

    await expect(verifyMagicLink(rawToken, DEVICE_ID)).rejects.toBeInstanceOf(MagicLinkInvalidError);
  });

  it('throws MagicLinkInvalidError when token is expired', async () => {
    mockEmailMagicLinkFindUnique.mockResolvedValue({
      ...MAGIC_LINK_ROW,
      expiresAt: new Date(Date.now() - 1000), // expired 1 second ago
    });

    await expect(verifyMagicLink(rawToken, DEVICE_ID)).rejects.toBeInstanceOf(MagicLinkInvalidError);
  });

  it('stores refresh token with correct parameters', async () => {
    mockEmailMagicLinkFindUnique.mockResolvedValue(MAGIC_LINK_ROW);

    await verifyMagicLink(rawToken, DEVICE_ID);

    expect(mockStoreRefreshToken).toHaveBeenCalledWith(
      TOKEN_PAIR.tokenId,
      USER_ID,
      DEVICE_ID,
      TOKEN_PAIR.refreshToken,
      expect.any(Date),
    );
  });
});
