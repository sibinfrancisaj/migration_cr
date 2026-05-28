import request from 'supertest';
import { createApp } from '../../../app.js';

// ─── Messaging mock ───────────────────────────────────────────────────────────

const mockCreateFirebaseToken = jest.fn();

jest.mock('@abroad-matrimony/messaging', () => {
  class FirebaseNotConfiguredError extends Error {
    constructor() { super('Firebase not configured'); this.name = 'FirebaseNotConfiguredError'; }
  }
  return {
    listConversations:        jest.fn().mockResolvedValue([]),
    getConversation:          jest.fn().mockResolvedValue({}),
    getConversationMessages:  jest.fn().mockResolvedValue({ messages: [], cursor: null, hasMore: false }),
    sendMessage:              jest.fn().mockResolvedValue({}),
    getUploadUrl:             jest.fn().mockResolvedValue({ uploadUrl: '', fileUrl: '' }),
    markConversationRead:     jest.fn().mockResolvedValue(undefined),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createFirebaseToken:      (...a: any[]) => mockCreateFirebaseToken(...a),
    FirebaseNotConfiguredError,
    flagMessage:              jest.fn().mockResolvedValue({}),
    MessageNotFoundError:     class extends Error { constructor() { super(); this.name = 'MessageNotFoundError'; } },
    AlreadyFlaggedError:      class extends Error { constructor() { super(); this.name = 'AlreadyFlaggedError'; } },
    FlagSelfError:            class extends Error { constructor() { super(); this.name = 'FlagSelfError'; } },
    MessageNotFoundForReadError: class extends Error { constructor() { super(); this.name = 'MessageNotFoundForReadError'; } },
    ConversationNotFoundError:   class extends Error { constructor() { super(); this.name = 'ConversationNotFoundError'; } },
    ConversationForbiddenError:  class extends Error { constructor() { super(); this.name = 'ConversationForbiddenError'; } },
    ConversationArchivedError:   class extends Error { constructor() { super(); this.name = 'ConversationArchivedError'; } },
    getAdminFlagSummary:      jest.fn().mockResolvedValue({ flags: [], total: 0 }),
    resolveFlag:              jest.fn().mockResolvedValue({}),
    FlagNotFoundError:        class extends Error { constructor() { super(); this.name = 'FlagNotFoundError'; } },
    CONVERSATION_MESSAGES_DEFAULT_LIMIT: 50,
    MessageType: { TEXT: 'TEXT', IMAGE: 'IMAGE', VOICE: 'VOICE', SYSTEM: 'SYSTEM' },
  };
});

import { FirebaseNotConfiguredError } from '@abroad-matrimony/messaging';

// ─── Auth mock ────────────────────────────────────────────────────────────────

let requireAuthBehavior: 'pass' | 'fail401' = 'pass';

jest.mock('@abroad-matrimony/auth', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (requireAuthBehavior === 'fail401') {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } });
    }
    req.user      = { id: 'user-uuid-1', role: 'USER', deviceId: 'device-uuid-1' };
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

jest.mock('@abroad-matrimony/config', () => ({
  getEnv: () => ({
    NODE_ENV:                'test',
    CORS_ORIGINS:            ['http://localhost:3000'],
    RATE_LIMIT_WINDOW_MS:    60000,
    RATE_LIMIT_MAX_REQUESTS: 100,
    OTP_RATE_LIMIT_MAX:      3,
    OTP_RATE_LIMIT_WINDOW_MS: 3600000,
  }),
}));

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

describe('GET /api/v1/auth/firebase-token', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAuthBehavior = 'pass';
  });

  it('returns 200 with token on success', async () => {
    mockCreateFirebaseToken.mockResolvedValue('firebase.custom.token.xyz');

    const res = await request(app).get('/api/v1/auth/firebase-token');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBe('firebase.custom.token.xyz');
  });

  it('returns 401 when unauthenticated', async () => {
    requireAuthBehavior = 'fail401';

    const res = await request(app).get('/api/v1/auth/firebase-token');

    expect(res.status).toBe(401);
  });

  it('returns 503 when Firebase is not configured', async () => {
    const mock = jest.requireMock('@abroad-matrimony/messaging') as {
      FirebaseNotConfiguredError: new () => Error;
    };
    mockCreateFirebaseToken.mockRejectedValue(new mock.FirebaseNotConfiguredError());

    const res = await request(app).get('/api/v1/auth/firebase-token');

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
  });

  it('returns 500 on unexpected error', async () => {
    mockCreateFirebaseToken.mockRejectedValue(new Error('Firebase SDK failure'));

    const res = await request(app).get('/api/v1/auth/firebase-token');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
