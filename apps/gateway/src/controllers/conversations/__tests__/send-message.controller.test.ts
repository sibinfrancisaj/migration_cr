import request from 'supertest';
import { createApp } from '../../../app.js';

// ─── Messaging mock ───────────────────────────────────────────────────────────

const mockSendMessage    = jest.fn();
const mockGetUploadUrl   = jest.fn();
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
    sendMessage:             (...a: any[]) => mockSendMessage(...a),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getUploadUrl:            (...a: any[]) => mockGetUploadUrl(...a),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    listConversations:       (...a: any[]) => mockListConversations(...a),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getConversation:         (...a: any[]) => mockGetConversation(...a),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getConversationMessages: (...a: any[]) => mockGetConversationMessages(...a),
    ConversationNotFoundError,
    ConversationForbiddenError,
    ConversationArchivedError,
    markConversationRead:    jest.fn().mockResolvedValue(undefined),
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
  ConversationArchivedError,
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

const CONV_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

const MESSAGE_DTO = {
  id:             'msg-001',
  conversationId: CONV_ID,
  senderId:       'user-me',
  type:           'TEXT',
  content:        'Hello!',
  flagCount:      0,
  isHidden:       false,
  readAt:         null,
  createdAt:      '2026-05-28T12:00:00.000Z',
};

const UPLOAD_URL_RESULT = {
  uploadUrl: 'https://s3.amazonaws.com/bucket/key?presigned=1',
  fileUrl:   'https://cdn.example.com/media/key.jpg',
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

// ─── Tests: POST /api/v1/conversations/:convId/messages ───────────────────────

describe('POST /api/v1/conversations/:convId/messages', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAuthBehavior = 'pass';
    mockSendMessage.mockResolvedValue(MESSAGE_DTO);
  });

  it('returns 201 with MessageDto on success', async () => {
    const res = await request(app)
      .post(`/api/v1/conversations/${CONV_ID}/messages`)
      .send({ type: 'TEXT', content: 'Hello!' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('msg-001');
    expect(res.body.data.content).toBe('Hello!');
  });

  it('calls sendMessage with userId, convId, type, content', async () => {
    await request(app)
      .post(`/api/v1/conversations/${CONV_ID}/messages`)
      .send({ type: 'TEXT', content: 'Hello!' });

    expect(mockSendMessage).toHaveBeenCalledWith('user-me', CONV_ID, 'TEXT', 'Hello!', undefined);
  });

  it('passes durationSeconds for VOICE messages', async () => {
    await request(app)
      .post(`/api/v1/conversations/${CONV_ID}/messages`)
      .send({ type: 'VOICE', content: 'https://cdn.example.com/voice.m4a', durationSeconds: 42 });

    expect(mockSendMessage).toHaveBeenCalledWith('user-me', CONV_ID, 'VOICE', 'https://cdn.example.com/voice.m4a', 42);
  });

  it('returns 400 when type is missing', async () => {
    const res = await request(app)
      .post(`/api/v1/conversations/${CONV_ID}/messages`)
      .send({ content: 'Hello!' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when content is empty', async () => {
    const res = await request(app)
      .post(`/api/v1/conversations/${CONV_ID}/messages`)
      .send({ type: 'TEXT', content: '' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when type is SYSTEM', async () => {
    const res = await request(app)
      .post(`/api/v1/conversations/${CONV_ID}/messages`)
      .send({ type: 'SYSTEM', content: 'system event' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when type is invalid', async () => {
    const res = await request(app)
      .post(`/api/v1/conversations/${CONV_ID}/messages`)
      .send({ type: 'INVALID', content: 'Hello!' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when convId is not a valid UUID', async () => {
    const res = await request(app)
      .post('/api/v1/conversations/not-a-uuid/messages')
      .send({ type: 'TEXT', content: 'Hello!' });

    expect(res.status).toBe(400);
  });

  it('returns 401 when not authenticated', async () => {
    requireAuthBehavior = 'fail401';

    const res = await request(app)
      .post(`/api/v1/conversations/${CONV_ID}/messages`)
      .send({ type: 'TEXT', content: 'Hello!' });

    expect(res.status).toBe(401);
  });

  it('returns 403 when caller is not a participant', async () => {
    mockSendMessage.mockRejectedValue(new ConversationForbiddenError());

    const res = await request(app)
      .post(`/api/v1/conversations/${CONV_ID}/messages`)
      .send({ type: 'TEXT', content: 'Hello!' });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 404 when conversation does not exist', async () => {
    mockSendMessage.mockRejectedValue(new ConversationNotFoundError());

    const res = await request(app)
      .post(`/api/v1/conversations/${CONV_ID}/messages`)
      .send({ type: 'TEXT', content: 'Hello!' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 409 when conversation is archived', async () => {
    mockSendMessage.mockRejectedValue(new ConversationArchivedError());

    const res = await request(app)
      .post(`/api/v1/conversations/${CONV_ID}/messages`)
      .send({ type: 'TEXT', content: 'Hello!' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('returns 500 on unexpected service error', async () => {
    mockSendMessage.mockRejectedValue(new Error('Firestore unavailable'));

    const res = await request(app)
      .post(`/api/v1/conversations/${CONV_ID}/messages`)
      .send({ type: 'TEXT', content: 'Hello!' });

    expect(res.status).toBe(500);
  });
});

// ─── Tests: GET /api/v1/conversations/:convId/upload-url ─────────────────────

describe('GET /api/v1/conversations/:convId/upload-url', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAuthBehavior = 'pass';
    mockGetUploadUrl.mockResolvedValue(UPLOAD_URL_RESULT);
  });

  it('returns 200 with uploadUrl and fileUrl', async () => {
    const res = await request(app)
      .get(`/api/v1/conversations/${CONV_ID}/upload-url?type=image&mimeType=image/jpeg`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.uploadUrl).toBe(UPLOAD_URL_RESULT.uploadUrl);
    expect(res.body.data.fileUrl).toBe(UPLOAD_URL_RESULT.fileUrl);
  });

  it('calls getUploadUrl with userId, convId, mimeType', async () => {
    await request(app)
      .get(`/api/v1/conversations/${CONV_ID}/upload-url?type=image&mimeType=image/jpeg`);

    expect(mockGetUploadUrl).toHaveBeenCalledWith('user-me', CONV_ID, 'image/jpeg');
  });

  it('accepts voice type with audio/m4a mimeType', async () => {
    const res = await request(app)
      .get(`/api/v1/conversations/${CONV_ID}/upload-url?type=voice&mimeType=audio/m4a`);

    expect(res.status).toBe(200);
    expect(mockGetUploadUrl).toHaveBeenCalledWith('user-me', CONV_ID, 'audio/m4a');
  });

  it('returns 400 when type is missing', async () => {
    const res = await request(app)
      .get(`/api/v1/conversations/${CONV_ID}/upload-url?mimeType=image/jpeg`);

    expect(res.status).toBe(400);
  });

  it('returns 400 when mimeType is missing', async () => {
    const res = await request(app)
      .get(`/api/v1/conversations/${CONV_ID}/upload-url?type=image`);

    expect(res.status).toBe(400);
  });

  it('returns 400 when mimeType is not in allowed list', async () => {
    const res = await request(app)
      .get(`/api/v1/conversations/${CONV_ID}/upload-url?type=image&mimeType=image/gif`);

    expect(res.status).toBe(400);
  });

  it('returns 400 when image type is given a voice mimeType', async () => {
    const res = await request(app)
      .get(`/api/v1/conversations/${CONV_ID}/upload-url?type=image&mimeType=audio/m4a`);

    expect(res.status).toBe(400);
  });

  it('returns 400 when voice type is given an image mimeType', async () => {
    const res = await request(app)
      .get(`/api/v1/conversations/${CONV_ID}/upload-url?type=voice&mimeType=image/jpeg`);

    expect(res.status).toBe(400);
  });

  it('returns 400 when convId is not a valid UUID', async () => {
    const res = await request(app)
      .get('/api/v1/conversations/bad-id/upload-url?type=image&mimeType=image/jpeg');

    expect(res.status).toBe(400);
  });

  it('returns 401 when not authenticated', async () => {
    requireAuthBehavior = 'fail401';

    const res = await request(app)
      .get(`/api/v1/conversations/${CONV_ID}/upload-url?type=image&mimeType=image/jpeg`);

    expect(res.status).toBe(401);
  });

  it('returns 403 when caller is not a participant', async () => {
    mockGetUploadUrl.mockRejectedValue(new ConversationForbiddenError());

    const res = await request(app)
      .get(`/api/v1/conversations/${CONV_ID}/upload-url?type=image&mimeType=image/jpeg`);

    expect(res.status).toBe(403);
  });

  it('returns 404 when conversation does not exist', async () => {
    mockGetUploadUrl.mockRejectedValue(new ConversationNotFoundError());

    const res = await request(app)
      .get(`/api/v1/conversations/${CONV_ID}/upload-url?type=image&mimeType=image/jpeg`);

    expect(res.status).toBe(404);
  });

  it('returns 409 when conversation is archived', async () => {
    mockGetUploadUrl.mockRejectedValue(new ConversationArchivedError());

    const res = await request(app)
      .get(`/api/v1/conversations/${CONV_ID}/upload-url?type=image&mimeType=image/jpeg`);

    expect(res.status).toBe(409);
  });

  it('returns 500 on unexpected service error', async () => {
    mockGetUploadUrl.mockRejectedValue(new Error('S3 down'));

    const res = await request(app)
      .get(`/api/v1/conversations/${CONV_ID}/upload-url?type=image&mimeType=image/jpeg`);

    expect(res.status).toBe(500);
  });
});
