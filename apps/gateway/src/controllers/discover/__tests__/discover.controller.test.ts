import request from 'supertest';
import { createApp } from '../../../app.js';
import { VerificationStatus } from '@abroad-matrimony/shared';

// ── Matching mock ─────────────────────────────────────────────────────────────

const mockGetDiscoveryFeed = jest.fn();

jest.mock('@abroad-matrimony/matching', () => ({
  getDiscoveryFeed:          (...args: unknown[]) => mockGetDiscoveryFeed(...args),
  ALGORITHM_VERSION:         'v1',
  // stubs for other exports the app may reference (worker)
  createScoreRecomputeWorker: jest.fn().mockReturnValue({ on: jest.fn(), close: jest.fn() }),
}));

// ── Config mock (with FeatureFlagService) ─────────────────────────────────────

jest.mock('@abroad-matrimony/config', () => {
  const mockIsEnabledFn = jest.fn().mockResolvedValue(false);
  return {
    getEnv: () => ({
      NODE_ENV:                'test',
      CORS_ORIGINS:            ['http://localhost:3000'],
      RATE_LIMIT_WINDOW_MS:    60000,
      RATE_LIMIT_MAX_REQUESTS: 100,
      OTP_RATE_LIMIT_MAX:      3,
      OTP_RATE_LIMIT_WINDOW_MS: 3600000,
    }),
    FeatureFlagService: jest.fn().mockImplementation(() => ({
      isEnabled: mockIsEnabledFn,
    })),
    _mockIsEnabled: mockIsEnabledFn,
  };
});

// DB mock (used by PrismaFeatureFlagStore internally)
jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    featureFlag: { findUnique: jest.fn().mockResolvedValue(null) },
  },
  PrismaClient: jest.fn(),
  Prisma: {},
}));

// ── Auth mock ─────────────────────────────────────────────────────────────────

let requireAuthBehavior: 'pass' | 'fail401' = 'pass';

jest.mock('@abroad-matrimony/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    if (requireAuthBehavior === 'fail401') {
      return _res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } });
    }
    req.user = { id: 'user-me', role: 'USER', deviceId: 'device-1' };
    req.requestId = 'test-request-id';
    next();
  },
  requireRole:             jest.fn(() => (_req: any, _res: any, next: any) => next()),
  requireAdminRole:        jest.fn(() => (_req: any, _res: any, next: any) => next()),
  checkAndIncrOtpRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
  getOtpAdapter:            jest.fn().mockReturnValue({ send: jest.fn().mockResolvedValue(undefined) }),
  otpVerifyService:         jest.fn().mockResolvedValue({}),
  tokenRefreshService:      jest.fn().mockResolvedValue({}),
  revokeForDevice:          jest.fn().mockResolvedValue(undefined),
  revokeAllForUser:         jest.fn().mockResolvedValue(undefined),
  OtpInvalidError:          class extends Error { constructor() { super(); this.name = 'OtpInvalidError'; } },
  DeviceLimitError:         class extends Error { constructor() { super(); this.name = 'DeviceLimitError'; } },
  TokenInvalidError:        class extends Error { constructor() { super(); this.name = 'TokenInvalidError'; } },
  TokenReuseError:          class extends Error { constructor() { super(); this.name = 'TokenReuseError'; } },
  checkAdminLoginRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
  adminLoginService:        jest.fn().mockResolvedValue({}),
  AdminCredentialsError:    class extends Error { constructor() { super(); this.name = 'AdminCredentialsError'; } },
  AdminTotpRequiredError:   class extends Error { constructor() { super(); this.name = 'AdminTotpRequiredError'; } },
  AdminTotpInvalidError:    class extends Error { constructor() { super(); this.name = 'AdminTotpInvalidError'; } },
  checkTrustedDeviceRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
  trustedDeviceLoginService:   jest.fn().mockResolvedValue({}),
  DeviceNotTrustedError:       class extends Error { constructor() { super('DEVICE_NOT_TRUSTED'); this.name = 'DeviceNotTrustedError'; } },
}));

// ── Profile mock (other routes) ───────────────────────────────────────────────

jest.mock('@abroad-matrimony/profile', () => ({
  createProfileService:     jest.fn().mockResolvedValue({}),
  upsertRealLifeAnswer:     jest.fn().mockResolvedValue({}),
  upsertStoryPrompt:        jest.fn().mockResolvedValue({}),
  getOwnProfile:            jest.fn().mockResolvedValue({}),
  getProfileById:           jest.fn().mockResolvedValue({}),
  uploadProfilePhoto:       jest.fn().mockResolvedValue({}),
  ProfileAlreadyExistsError: class extends Error { constructor() { super(); this.name = 'ProfileAlreadyExistsError'; } },
  ProfileNotFoundError:      class extends Error { constructor() { super(); this.name = 'ProfileNotFoundError'; } },
  PhotoLimitExceededError:   class extends Error { constructor() { super(); this.name = 'PhotoLimitExceededError'; } },
  InvalidMimeTypeError:      class extends Error { constructor() { super(); this.name = 'InvalidMimeTypeError'; } },
}));

// ── Groups + Connections stubs (registered routes) ────────────────────────────

jest.mock('@abroad-matrimony/groups', () => ({
  createGroupService: jest.fn().mockResolvedValue({}),
}));

jest.mock('@abroad-matrimony/connections', () => ({
  sendConnectionService:     jest.fn().mockResolvedValue({}),
  acceptConnectionService:   jest.fn().mockResolvedValue({}),
  declineConnectionService:  jest.fn().mockResolvedValue({}),
  ConnectionAlreadyExistsError: class extends Error { constructor() { super(); this.name = 'ConnectionAlreadyExistsError'; } },
  ConnectionNotFoundError:      class extends Error { constructor() { super(); this.name = 'ConnectionNotFoundError'; } },
  ConnectionForbiddenError:     class extends Error { constructor() { super(); this.name = 'ConnectionForbiddenError'; } },
}));

// ── Messaging mock ────────────────────────────────────────────────────────────

jest.mock('@abroad-matrimony/messaging', () => ({
  listConversations:        jest.fn().mockResolvedValue([]),
  getConversation:          jest.fn().mockResolvedValue({}),
  getConversationMessages:  jest.fn().mockResolvedValue({ messages: [], cursor: null, hasMore: false }),
  sendMessage:              jest.fn().mockResolvedValue({}),
  getUploadUrl:             jest.fn().mockResolvedValue({ uploadUrl: '', fileUrl: '' }),
  ConversationNotFoundError: class extends Error { constructor() { super(); this.name = 'ConversationNotFoundError'; } },
  ConversationForbiddenError: class extends Error { constructor() { super(); this.name = 'ConversationForbiddenError'; } },
  ConversationArchivedError:  class extends Error { constructor() { super(); this.name = 'ConversationArchivedError'; } },
  markConversationRead:       jest.fn().mockResolvedValue(undefined),
  MessageNotFoundForReadError: class extends Error { constructor() { super(); this.name = 'MessageNotFoundForReadError'; } },
  createFirebaseToken:         jest.fn().mockResolvedValue('mock-firebase-token'),
  FirebaseNotConfiguredError:  class extends Error { constructor() { super(); this.name = 'FirebaseNotConfiguredError'; } },
  flagMessage:                 jest.fn().mockResolvedValue({ id: 'flag-1', status: 'OPEN' }),
  MessageNotFoundError:        class extends Error { constructor() { super(); this.name = 'MessageNotFoundError'; } },
  AlreadyFlaggedError:         class extends Error { constructor() { super(); this.name = 'AlreadyFlaggedError'; } },
  FlagSelfError:               class extends Error { constructor() { super(); this.name = 'FlagSelfError'; } },
  getAdminFlagSummary:         jest.fn().mockResolvedValue({ flags: [], total: 0 }),
  resolveFlag:                 jest.fn().mockResolvedValue({ id: 'flag-1', status: 'RESOLVED' }),
  FlagNotFoundError:           class extends Error { constructor() { super(); this.name = 'FlagNotFoundError'; } },
  CONVERSATION_MESSAGES_DEFAULT_LIMIT: 50,
  MessageType: { TEXT: 'TEXT', IMAGE: 'IMAGE', VOICE: 'VOICE', SYSTEM: 'SYSTEM' },
}));

// ── Cache mock ────────────────────────────────────────────────────────────────

jest.mock('@abroad-matrimony/cache', () => ({
  getRedisClient:  jest.fn(),
  cacheGet:        jest.fn().mockResolvedValue(null),
  cacheSet:        jest.fn().mockResolvedValue('OK'),
  cacheDel:        jest.fn().mockResolvedValue(1),
  closeRedisClient: jest.fn(),
}));

// ── Event-bus mock ────────────────────────────────────────────────────────────

jest.mock('@abroad-matrimony/event-bus', () => ({
  initEventBus:     jest.fn(),
  shutdownEventBus: jest.fn(),
  publish:          jest.fn(),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DISCOVERY_ITEM = {
  userId:           'user-a',
  name:             'Alice',
  age:              35,
  currentCity:      'London',
  currentCountry:   'UK',
  settlementIntent: 'STAY_ABROAD',
  completionScore:  90,
  verificationStatus: VerificationStatus.APPROVED,
  photoUrl:         'https://cdn/alice.jpg',
  totalScore:       0.9,
  scoreBreakdown: {
    verification: 1, settlementIntent: 0.8, realLifeAnswers: 0.9,
    profileCompleteness: 0.8, checkInRecency: 1, ageCompatibility: 0.8,
    groupMembership: 1, languageMatch: 1, faithAlignment: 1,
  },
};

const EMPTY_FEED = { items: [], nextCursor: null, hasMore: false };

function getMockIsEnabled() {
  return (jest.requireMock('@abroad-matrimony/config') as { _mockIsEnabled: jest.Mock })
    ._mockIsEnabled;
}

// ── Payment mock (payment router registered in routes/index.ts) ───────────────
jest.mock('@abroad-matrimony/payment', () => ({
  createMembershipCheckout:      jest.fn().mockResolvedValue({ checkoutUrl: 'https://checkout.mock/session', sessionId: 'cs_mock_123' }),
  createDiamondCheckout:         jest.fn().mockResolvedValue({ checkoutUrl: 'https://checkout.mock/diamonds', sessionId: 'cs_mock_diamond' }),
  createRazorpayMembershipOrder: jest.fn().mockResolvedValue({ orderId: 'order_mock_123', amount: 99900, currency: 'INR', keyId: 'rzp_test_mock' }),
  captureRazorpayPayment:        jest.fn().mockResolvedValue(undefined),
  processStripeWebhook:          jest.fn().mockResolvedValue(undefined),
  processRazorpayWebhook:        jest.fn().mockResolvedValue(undefined),
  getActiveMembership:           jest.fn().mockResolvedValue(null),
  getDiamondBalance:             jest.fn().mockResolvedValue(0),
  spendDiamonds:                 jest.fn().mockResolvedValue(0),
  markPaymentRefunded:           jest.fn().mockResolvedValue(undefined),
  refundDiamonds:                jest.fn().mockResolvedValue(0),
  DIAMOND_PACKAGES:              { DIAMONDS_50: { packageKey: 'DIAMONDS_50', diamonds: 50, amountPaise: 49900, currency: 'INR', description: '50 Diamonds' } },
  PaymentSignatureError:         class extends Error { constructor() { super('Payment signature verification failed'); this.name = 'PaymentSignatureError'; } },
  PaymentNotFoundError:          class extends Error { constructor() { super('PAYMENT_NOT_FOUND'); this.name = 'PaymentNotFoundError'; } },
  InvalidDiamondPackageError:    class extends Error { constructor() { super('INVALID_DIAMOND_PACKAGE'); this.name = 'InvalidDiamondPackageError'; } },
  InsufficientDiamondsError:     class extends Error { constructor() { super('INSUFFICIENT_DIAMONDS'); this.name = 'InsufficientDiamondsError'; } },
  MembershipAlreadyActiveError:  class extends Error { constructor() { super('MEMBERSHIP_ALREADY_ACTIVE'); this.name = 'MembershipAlreadyActiveError'; } },
}));

const app = createApp();

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/v1/discover', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAuthBehavior = 'pass';
    mockGetDiscoveryFeed.mockResolvedValue({
      items: [DISCOVERY_ITEM],
      nextCursor: null,
      hasMore: false,
    });
    getMockIsEnabled().mockResolvedValue(false);
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  it('returns 200 with discovery items', async () => {
    const res = await request(app).get('/api/v1/discover');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].userId).toBe('user-a');
  });

  it('includes pagination meta in the response', async () => {
    mockGetDiscoveryFeed.mockResolvedValue({
      items: [DISCOVERY_ITEM],
      nextCursor: 'cursor-xyz',
      hasMore: true,
    });

    const res = await request(app).get('/api/v1/discover');

    expect(res.body.meta.cursor).toBe('cursor-xyz');
    expect(res.body.meta.hasMore).toBe(true);
  });

  it('returns empty items with hasMore=false on an empty feed', async () => {
    mockGetDiscoveryFeed.mockResolvedValue(EMPTY_FEED);

    const res = await request(app).get('/api/v1/discover');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.meta.hasMore).toBe(false);
  });

  it('passes limit query param to getDiscoveryFeed', async () => {
    await request(app).get('/api/v1/discover?limit=5');

    expect(mockGetDiscoveryFeed).toHaveBeenCalledWith(
      'user-me',
      expect.objectContaining({ limit: 5 }),
    );
  });

  it('passes cursor query param to getDiscoveryFeed', async () => {
    await request(app).get('/api/v1/discover?cursor=abc123');

    expect(mockGetDiscoveryFeed).toHaveBeenCalledWith(
      'user-me',
      expect.objectContaining({ cursor: 'abc123' }),
    );
  });

  // ── MATCH-005 feature flag ──────────────────────────────────────────────────

  it('uses algorithmVersion v1 when the v2 feature flag is disabled (default)', async () => {
    getMockIsEnabled().mockResolvedValue(false);

    await request(app).get('/api/v1/discover');

    expect(mockGetDiscoveryFeed).toHaveBeenCalledWith(
      'user-me',
      expect.objectContaining({ algorithmVersion: 'v1' }),
    );
  });

  it('uses algorithmVersion v2 when the v2 feature flag is enabled for the user', async () => {
    getMockIsEnabled().mockResolvedValue(true);

    await request(app).get('/api/v1/discover');

    expect(mockGetDiscoveryFeed).toHaveBeenCalledWith(
      'user-me',
      expect.objectContaining({ algorithmVersion: 'v2' }),
    );
  });

  // ── Validation ──────────────────────────────────────────────────────────────

  it('returns 400 when limit is not a valid number', async () => {
    const res = await request(app).get('/api/v1/discover?limit=abc');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when limit exceeds MAX_PAGE_SIZE (100)', async () => {
    const res = await request(app).get('/api/v1/discover?limit=999');

    expect(res.status).toBe(400);
  });

  it('returns 400 when limit is 0', async () => {
    const res = await request(app).get('/api/v1/discover?limit=0');

    expect(res.status).toBe(400);
  });

  // ── Auth guard ──────────────────────────────────────────────────────────────

  it('returns 401 when the user is not authenticated', async () => {
    requireAuthBehavior = 'fail401';

    const res = await request(app).get('/api/v1/discover');

    expect(res.status).toBe(401);
  });

  // ── Error handling ──────────────────────────────────────────────────────────

  it('returns 500 when getDiscoveryFeed throws an unexpected error', async () => {
    mockGetDiscoveryFeed.mockRejectedValue(new Error('DB connection lost'));

    const res = await request(app).get('/api/v1/discover');

    expect(res.status).toBe(500);
  });
});
