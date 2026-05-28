import request from 'supertest';
import { createApp } from '../../../app.js';

// ─── Messaging mock ───────────────────────────────────────────────────────────

const mockListConversations    = jest.fn();
const mockGetConversation      = jest.fn();
const mockGetConversationMessages = jest.fn();

jest.mock('@abroad-matrimony/messaging', () => {
  class ConversationNotFoundError extends Error {
    constructor() { super('CONVERSATION_NOT_FOUND'); this.name = 'ConversationNotFoundError'; }
  }
  class ConversationForbiddenError extends Error {
    constructor() { super('CONVERSATION_FORBIDDEN'); this.name = 'ConversationForbiddenError'; }
  }
  class ConversationArchivedError extends Error {
    constructor() { super('CONVERSATION_ARCHIVED'); this.name = 'ConversationArchivedError'; }
  }
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    listConversations:       (...a: any[]) => mockListConversations(...a),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getConversation:         (...a: any[]) => mockGetConversation(...a),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getConversationMessages: (...a: any[]) => mockGetConversationMessages(...a),
    sendMessage:             jest.fn().mockResolvedValue({}),
    getUploadUrl:            jest.fn().mockResolvedValue({ uploadUrl: '', fileUrl: '' }),
    markConversationRead:    jest.fn().mockResolvedValue(undefined),
    ConversationNotFoundError,
    ConversationForbiddenError,
    ConversationArchivedError,
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
  };
});

import {
  ConversationNotFoundError,
  ConversationForbiddenError,
} from '@abroad-matrimony/messaging';

// ─── Auth mock ────────────────────────────────────────────────────────────────

let requireAuthBehavior: 'pass' | 'fail401' = 'pass';

jest.mock('@abroad-matrimony/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    if (requireAuthBehavior === 'fail401') {
      return _res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } });
    }
    req.user      = { id: 'user-me', role: 'USER', deviceId: 'device-1' };
    req.requestId = 'test-request-id';
    next();
  },
  requireRole:              jest.fn(() => (_req: any, _res: any, next: any) => next()),
  requireAdminRole:         jest.fn(() => (_req: any, _res: any, next: any) => next()),
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

// ─── Config mock ──────────────────────────────────────────────────────────────

jest.mock('@abroad-matrimony/config', () => ({
  getEnv: () => ({
    NODE_ENV:                'test',
    CORS_ORIGINS:            ['http://localhost:3000'],
    RATE_LIMIT_WINDOW_MS:    60000,
    RATE_LIMIT_MAX_REQUESTS: 100,
    OTP_RATE_LIMIT_MAX:      3,
    OTP_RATE_LIMIT_WINDOW_MS: 3600000,
  }),
  FeatureFlagService: jest.fn().mockImplementation(() => ({
    isEnabled: jest.fn().mockResolvedValue(false),
  })),
}));

// ─── Other required mocks ─────────────────────────────────────────────────────

jest.mock('@abroad-matrimony/db', () => ({
  prisma: { featureFlag: { findUnique: jest.fn().mockResolvedValue(null) } },
  PrismaClient: jest.fn(),
  Prisma: {},
}));

jest.mock('@abroad-matrimony/matching', () => ({
  getDiscoveryFeed:           jest.fn().mockResolvedValue({ items: [], nextCursor: null, hasMore: false }),
  ALGORITHM_VERSION:          'v1',
  createScoreRecomputeWorker: jest.fn().mockReturnValue({ on: jest.fn(), close: jest.fn() }),
}));

jest.mock('@abroad-matrimony/profile', () => ({
  createProfileService:      jest.fn().mockResolvedValue({}),
  upsertRealLifeAnswer:      jest.fn().mockResolvedValue({}),
  upsertStoryPrompt:         jest.fn().mockResolvedValue({}),
  getOwnProfile:             jest.fn().mockResolvedValue({}),
  getProfileById:            jest.fn().mockResolvedValue({}),
  uploadProfilePhoto:        jest.fn().mockResolvedValue({}),
  ProfileAlreadyExistsError:  class extends Error { constructor() { super(); this.name = 'ProfileAlreadyExistsError'; } },
  ProfileNotFoundError:       class extends Error { constructor() { super(); this.name = 'ProfileNotFoundError'; } },
  PhotoLimitExceededError:    class extends Error { constructor() { super(); this.name = 'PhotoLimitExceededError'; } },
  InvalidMimeTypeError:       class extends Error { constructor() { super(); this.name = 'InvalidMimeTypeError'; } },
}));

jest.mock('@abroad-matrimony/connections', () => ({
  sendConnectionService:        jest.fn().mockResolvedValue({}),
  acceptConnectionService:      jest.fn().mockResolvedValue({}),
  declineConnectionService:     jest.fn().mockResolvedValue({}),
  ConnectionAlreadyExistsError: class extends Error { constructor() { super(); this.name = 'ConnectionAlreadyExistsError'; } },
  ConnectionNotFoundError:      class extends Error { constructor() { super(); this.name = 'ConnectionNotFoundError'; } },
  ConnectionForbiddenError:     class extends Error { constructor() { super(); this.name = 'ConnectionForbiddenError'; } },
}));

jest.mock('@abroad-matrimony/groups', () => ({
  createGroupService: jest.fn().mockResolvedValue({}),
}));

jest.mock('@abroad-matrimony/cache', () => ({
  getRedisClient:   jest.fn(),
  cacheGet:         jest.fn().mockResolvedValue(null),
  cacheSet:         jest.fn().mockResolvedValue('OK'),
  cacheDel:         jest.fn().mockResolvedValue(1),
  closeRedisClient: jest.fn(),
}));

jest.mock('@abroad-matrimony/event-bus', () => ({
  initEventBus:     jest.fn(),
  shutdownEventBus: jest.fn(),
  publish:          jest.fn(),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CONV_ID  = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
const CONV_SUMMARY = {
  conversationId: CONV_ID,
  matchId:        'match-001',
  otherUser: { userId: 'user-b', name: 'Alice', photoUrl: null },
  lastMessageAt:  null,
  unreadCount:    0,
  isArchived:     false,
  createdAt:      '2026-05-28T10:00:00.000Z',
};

const MSG_PAGE = {
  messages: [
    { id: 'msg-1', conversationId: CONV_ID, senderId: 'user-b', type: 'TEXT', content: 'Hello!', flagCount: 0, isHidden: false, readAt: null, createdAt: '2026-05-28T11:00:00.000Z' },
  ],
  cursor: '2026-05-28T11:00:00.000Z',
  hasMore: false,
};

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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/v1/conversations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAuthBehavior = 'pass';
    mockListConversations.mockResolvedValue([CONV_SUMMARY]);
  });

  it('returns 200 with a list of conversations', async () => {
    const res = await request(app).get('/api/v1/conversations');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].conversationId).toBe(CONV_ID);
  });

  it('returns total count in meta', async () => {
    const res = await request(app).get('/api/v1/conversations');

    expect(res.body.meta.total).toBe(1);
    expect(res.body.meta.hasMore).toBe(false);
  });

  it('calls listConversations with the authenticated userId', async () => {
    await request(app).get('/api/v1/conversations');

    expect(mockListConversations).toHaveBeenCalledWith('user-me');
  });

  it('returns empty array when user has no conversations', async () => {
    mockListConversations.mockResolvedValue([]);

    const res = await request(app).get('/api/v1/conversations');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.meta.total).toBe(0);
  });

  it('returns 401 when not authenticated', async () => {
    requireAuthBehavior = 'fail401';

    const res = await request(app).get('/api/v1/conversations');

    expect(res.status).toBe(401);
  });

  it('returns 500 on unexpected service error', async () => {
    mockListConversations.mockRejectedValue(new Error('DB down'));

    const res = await request(app).get('/api/v1/conversations');

    expect(res.status).toBe(500);
  });
});

describe('GET /api/v1/conversations/:convId', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAuthBehavior = 'pass';
    mockGetConversation.mockResolvedValue(CONV_SUMMARY);
  });

  it('returns 200 with conversation metadata', async () => {
    const res = await request(app).get(`/api/v1/conversations/${CONV_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.conversationId).toBe(CONV_ID);
    expect(res.body.data.otherUser.name).toBe('Alice');
  });

  it('calls getConversation with userId and convId', async () => {
    await request(app).get(`/api/v1/conversations/${CONV_ID}`);

    expect(mockGetConversation).toHaveBeenCalledWith('user-me', CONV_ID);
  });

  it('returns 404 when conversation does not exist', async () => {
    mockGetConversation.mockRejectedValue(new ConversationNotFoundError());

    const res = await request(app).get(`/api/v1/conversations/${CONV_ID}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 403 when caller is not a participant', async () => {
    mockGetConversation.mockRejectedValue(new ConversationForbiddenError());

    const res = await request(app).get(`/api/v1/conversations/${CONV_ID}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 400 when convId is not a valid UUID', async () => {
    const res = await request(app).get('/api/v1/conversations/not-a-uuid');

    expect(res.status).toBe(400);
  });

  it('returns 401 when not authenticated', async () => {
    requireAuthBehavior = 'fail401';

    const res = await request(app).get(`/api/v1/conversations/${CONV_ID}`);

    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/conversations/:convId/messages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAuthBehavior = 'pass';
    mockGetConversationMessages.mockResolvedValue(MSG_PAGE);
  });

  it('returns 200 with messages and pagination meta', async () => {
    const res = await request(app).get(`/api/v1/conversations/${CONV_ID}/messages`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].content).toBe('Hello!');
    expect(res.body.meta.hasMore).toBe(false);
  });

  it('calls getConversationMessages with correct params', async () => {
    await request(app).get(`/api/v1/conversations/${CONV_ID}/messages?limit=10`);

    expect(mockGetConversationMessages).toHaveBeenCalledWith('user-me', CONV_ID, 10, undefined);
  });

  it('passes cursor param to service', async () => {
    const cursor = encodeURIComponent('2026-05-28T11:00:00.000Z');
    await request(app).get(`/api/v1/conversations/${CONV_ID}/messages?cursor=${cursor}`);

    expect(mockGetConversationMessages).toHaveBeenCalledWith(
      'user-me',
      CONV_ID,
      50, // default
      '2026-05-28T11:00:00.000Z',
    );
  });

  it('includes cursor in meta when hasMore is true', async () => {
    mockGetConversationMessages.mockResolvedValue({
      messages: [MSG_PAGE.messages[0]],
      cursor: '2026-05-28T10:00:00.000Z',
      hasMore: true,
    });

    const res = await request(app).get(`/api/v1/conversations/${CONV_ID}/messages`);

    expect(res.body.meta.cursor).toBe('2026-05-28T10:00:00.000Z');
    expect(res.body.meta.hasMore).toBe(true);
  });

  it('returns 400 when limit is 0', async () => {
    const res = await request(app).get(`/api/v1/conversations/${CONV_ID}/messages?limit=0`);
    expect(res.status).toBe(400);
  });

  it('returns 400 when limit exceeds 100', async () => {
    const res = await request(app).get(`/api/v1/conversations/${CONV_ID}/messages?limit=101`);
    expect(res.status).toBe(400);
  });

  it('returns 400 when convId is not a valid UUID', async () => {
    const res = await request(app).get('/api/v1/conversations/bad-id/messages');
    expect(res.status).toBe(400);
  });

  it('returns 404 when conversation does not exist', async () => {
    mockGetConversationMessages.mockRejectedValue(new ConversationNotFoundError());

    const res = await request(app).get(`/api/v1/conversations/${CONV_ID}/messages`);

    expect(res.status).toBe(404);
  });

  it('returns 403 when caller is not a participant', async () => {
    mockGetConversationMessages.mockRejectedValue(new ConversationForbiddenError());

    const res = await request(app).get(`/api/v1/conversations/${CONV_ID}/messages`);

    expect(res.status).toBe(403);
  });

  it('returns 401 when not authenticated', async () => {
    requireAuthBehavior = 'fail401';

    const res = await request(app).get(`/api/v1/conversations/${CONV_ID}/messages`);

    expect(res.status).toBe(401);
  });

  it('returns 500 on unexpected service error', async () => {
    mockGetConversationMessages.mockRejectedValue(new Error('Firestore unavailable'));

    const res = await request(app).get(`/api/v1/conversations/${CONV_ID}/messages`);

    expect(res.status).toBe(500);
  });
});
