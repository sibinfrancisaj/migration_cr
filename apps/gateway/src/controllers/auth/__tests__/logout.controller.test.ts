import request from 'supertest';
import { createApp } from '../../../app.js';

const mockRevokeForDevice = jest.fn();
const mockRevokeAllForUser = jest.fn();

// requireAuth mock — attaches req.user and calls next() by default
let requireAuthBehavior: 'pass' | 'fail401' | 'fail403' = 'pass';

jest.mock('@abroad-matrimony/auth', () => ({
  revokeForDevice: (...args: unknown[]) => mockRevokeForDevice(...args),
  revokeAllForUser: (...args: unknown[]) => mockRevokeAllForUser(...args),
  // Middleware mock: controlled via requireAuthBehavior
  requireAuth: (req: any, res: any, next: any) => {
    if (requireAuthBehavior === 'fail401') {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Auth required.' } });
    }
    if (requireAuthBehavior === 'fail403') {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Account suspended.' } });
    }
    req.user = { id: 'user-uuid-1', role: 'USER', deviceId: 'device-uuid-1' };
    next();
  },
  // Stub other exports used by the app module
  checkAndIncrOtpRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
  getOtpAdapter: jest.fn().mockReturnValue({ send: jest.fn().mockResolvedValue(undefined) }),
  otpVerifyService: jest.fn().mockResolvedValue({}),
  tokenRefreshService: jest.fn().mockResolvedValue({}),
  OtpInvalidError:   class OtpInvalidError   extends Error { constructor() { super(); this.name = 'OtpInvalidError'; } },
  DeviceLimitError:  class DeviceLimitError   extends Error { constructor() { super(); this.name = 'DeviceLimitError'; } },
  TokenInvalidError: class TokenInvalidError  extends Error { constructor() { super(); this.name = 'TokenInvalidError'; } },
  TokenReuseError:   class TokenReuseError    extends Error { constructor() { super(); this.name = 'TokenReuseError'; } },
  // Admin auth stubs
  requireRole:              jest.fn(() => (_req: any, _res: any, next: any) => next()),
  requireAdminRole:         jest.fn(() => (_req: any, _res: any, next: any) => next()),
  checkAdminLoginRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
  adminLoginService:        jest.fn().mockResolvedValue({}),
  AdminCredentialsError:  class AdminCredentialsError  extends Error { constructor() { super(); this.name = 'AdminCredentialsError'; } },
  AdminTotpRequiredError: class AdminTotpRequiredError extends Error { constructor() { super(); this.name = 'AdminTotpRequiredError'; } },
  AdminTotpInvalidError:  class AdminTotpInvalidError  extends Error { constructor() { super(); this.name = 'AdminTotpInvalidError'; } },
  checkTrustedDeviceRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
  trustedDeviceLoginService:   jest.fn().mockResolvedValue({}),
  DeviceNotTrustedError:       class extends Error { constructor() { super('DEVICE_NOT_TRUSTED'); this.name = 'DeviceNotTrustedError'; } },
}));

jest.mock('@abroad-matrimony/config', () => ({
  getEnv: () => ({
    NODE_ENV: 'test',
    CORS_ORIGINS: ['http://localhost:3000'],
    RATE_LIMIT_WINDOW_MS: 60000,
    RATE_LIMIT_MAX_REQUESTS: 100,
    OTP_RATE_LIMIT_MAX: 3,
    OTP_RATE_LIMIT_WINDOW_MS: 3600000,
  }),
}));

// ── Messaging mock (conversations router registered in routes/index.ts) ────────
jest.mock('@abroad-matrimony/messaging', () => ({
  listConversations:        jest.fn().mockResolvedValue([]),
  getConversation:          jest.fn().mockResolvedValue({}),
  getConversationMessages:  jest.fn().mockResolvedValue({ messages: [], cursor: null, hasMore: false }),
  sendMessage:              jest.fn().mockResolvedValue({}),
  getUploadUrl:             jest.fn().mockResolvedValue({ uploadUrl: '', fileUrl: '' }),
  ConversationNotFoundError: class extends Error { constructor() { super(); this.name = 'ConversationNotFoundError'; } },
  ConversationForbiddenError: class extends Error { constructor() { super(); this.name = 'ConversationForbiddenError'; } },
  ConversationArchivedError:  class extends Error { constructor() { super(); this.name = 'ConversationArchivedError'; } },
  CONVERSATION_MESSAGES_DEFAULT_LIMIT: 50,
  MessageType: { TEXT: 'TEXT', IMAGE: 'IMAGE', VOICE: 'VOICE', SYSTEM: 'SYSTEM' },
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

describe('POST /api/v1/auth/logout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAuthBehavior = 'pass';
    mockRevokeForDevice.mockResolvedValue(undefined);
  });

  it('returns 204 No Content on successful logout', async () => {
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', 'Bearer valid.token');

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  });

  it('calls revokeForDevice with the userId and deviceId from req.user', async () => {
    await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', 'Bearer valid.token');

    expect(mockRevokeForDevice).toHaveBeenCalledWith('user-uuid-1', 'device-uuid-1');
  });

  it('returns 401 when Authorization header is missing', async () => {
    requireAuthBehavior = 'fail401';

    const res = await request(app)
      .post('/api/v1/auth/logout');

    expect(res.status).toBe(401);
    expect(mockRevokeForDevice).not.toHaveBeenCalled();
  });

  it('returns 403 when account is suspended', async () => {
    requireAuthBehavior = 'fail403';

    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', 'Bearer suspended.token');

    expect(res.status).toBe(403);
    expect(mockRevokeForDevice).not.toHaveBeenCalled();
  });

  it('returns 500 when revokeForDevice throws', async () => {
    mockRevokeForDevice.mockRejectedValueOnce(new Error('Redis down'));

    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', 'Bearer valid.token');

    expect(res.status).toBe(500);
  });

  it('propagates X-Request-ID through the response', async () => {
    const customId = 'logout-test-id-1111';
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', 'Bearer valid.token')
      .set('X-Request-ID', customId);

    expect(res.headers['x-request-id']).toBe(customId);
  });
});

describe('POST /api/v1/auth/logout/all', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAuthBehavior = 'pass';
    mockRevokeAllForUser.mockResolvedValue(undefined);
  });

  it('returns 204 No Content on successful logout-all', async () => {
    const res = await request(app)
      .post('/api/v1/auth/logout/all')
      .set('Authorization', 'Bearer valid.token');

    expect(res.status).toBe(204);
  });

  it('calls revokeAllForUser with the userId from req.user', async () => {
    await request(app)
      .post('/api/v1/auth/logout/all')
      .set('Authorization', 'Bearer valid.token');

    expect(mockRevokeAllForUser).toHaveBeenCalledWith('user-uuid-1');
  });

  it('returns 401 when Authorization header is missing', async () => {
    requireAuthBehavior = 'fail401';

    const res = await request(app)
      .post('/api/v1/auth/logout/all');

    expect(res.status).toBe(401);
    expect(mockRevokeAllForUser).not.toHaveBeenCalled();
  });

  it('returns 500 when revokeAllForUser throws', async () => {
    mockRevokeAllForUser.mockRejectedValueOnce(new Error('DB timeout'));

    const res = await request(app)
      .post('/api/v1/auth/logout/all')
      .set('Authorization', 'Bearer valid.token');

    expect(res.status).toBe(500);
  });

  it('propagates X-Request-ID through the response', async () => {
    const customId = 'logout-all-test-id-2222';
    const res = await request(app)
      .post('/api/v1/auth/logout/all')
      .set('Authorization', 'Bearer valid.token')
      .set('X-Request-ID', customId);

    expect(res.headers['x-request-id']).toBe(customId);
  });
});
