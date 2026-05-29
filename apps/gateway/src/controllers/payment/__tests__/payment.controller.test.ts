import request from 'supertest';
import { createApp } from '../../../app.js';
import { DiamondReason } from '@abroad-matrimony/shared';

// ── Service mocks ──────────────────────────────────────────────────────────────

const mockCreateMembershipCheckout      = jest.fn();
const mockCreateDiamondCheckout         = jest.fn();
const mockCreateRazorpayMembershipOrder = jest.fn();
const mockCaptureRazorpayPayment        = jest.fn();
const mockProcessStripeWebhook          = jest.fn();
const mockProcessRazorpayWebhook        = jest.fn();
const mockGetActiveMembership           = jest.fn();
const mockGetDiamondBalance             = jest.fn();
const mockSpendDiamonds                 = jest.fn();
const mockMarkPaymentRefunded           = jest.fn();
const mockRefundDiamonds                = jest.fn();
const mockGetCreditTransactions         = jest.fn();

// Error classes are defined INSIDE the factory to avoid TDZ issues with jest.mock hoisting.
// They are re-imported from the mock below for use in test assertions.
jest.mock('@abroad-matrimony/payment', () => ({
  createMembershipCheckout:      (...a: unknown[]) => mockCreateMembershipCheckout(...a),
  createDiamondCheckout:         (...a: unknown[]) => mockCreateDiamondCheckout(...a),
  createRazorpayMembershipOrder: (...a: unknown[]) => mockCreateRazorpayMembershipOrder(...a),
  captureRazorpayPayment:        (...a: unknown[]) => mockCaptureRazorpayPayment(...a),
  processStripeWebhook:          (...a: unknown[]) => mockProcessStripeWebhook(...a),
  processRazorpayWebhook:        (...a: unknown[]) => mockProcessRazorpayWebhook(...a),
  getActiveMembership:           (...a: unknown[]) => mockGetActiveMembership(...a),
  getDiamondBalance:             (...a: unknown[]) => mockGetDiamondBalance(...a),
  spendDiamonds:                 (...a: unknown[]) => mockSpendDiamonds(...a),
  markPaymentRefunded:           (...a: unknown[]) => mockMarkPaymentRefunded(...a),
  refundDiamonds:                (...a: unknown[]) => mockRefundDiamonds(...a),
  getCreditTransactions:         (...a: unknown[]) => mockGetCreditTransactions(...a),
  DIAMOND_PACKAGES: {
    DIAMONDS_50:  { packageKey: 'DIAMONDS_50',  diamonds: 50,  amountPaise: 49900  },
    DIAMONDS_100: { packageKey: 'DIAMONDS_100', diamonds: 100, amountPaise: 89900  },
    DIAMONDS_200: { packageKey: 'DIAMONDS_200', diamonds: 200, amountPaise: 149900 },
  },
  PaymentSignatureError:      class extends Error { constructor() { super('Payment signature verification failed'); this.name = 'PaymentSignatureError'; } },
  PaymentNotFoundError:       class extends Error { constructor() { super('PAYMENT_NOT_FOUND'); this.name = 'PaymentNotFoundError'; } },
  InvalidDiamondPackageError: class extends Error { constructor() { super('INVALID_DIAMOND_PACKAGE'); this.name = 'InvalidDiamondPackageError'; } },
  InsufficientDiamondsError:  class extends Error { constructor() { super('INSUFFICIENT_DIAMONDS'); this.name = 'InsufficientDiamondsError'; } },
  MembershipAlreadyActiveError: class extends Error { constructor() { super('MEMBERSHIP_ALREADY_ACTIVE'); this.name = 'MembershipAlreadyActiveError'; } },
}));

// Re-import error classes from the mock so instanceof checks work in tests
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const paymentMock = jest.requireMock('@abroad-matrimony/payment') as any;
const PaymentSignatureError      = paymentMock.PaymentSignatureError as typeof Error;
const PaymentNotFoundError       = paymentMock.PaymentNotFoundError as typeof Error;
const InvalidDiamondPackageError = paymentMock.InvalidDiamondPackageError as typeof Error;
const InsufficientDiamondsError  = paymentMock.InsufficientDiamondsError as typeof Error;

jest.mock('@abroad-matrimony/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-uuid-1', role: 'USER', deviceId: 'device-uuid-1' };
    req.admin = undefined;
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
    NODE_ENV: 'test',
    CORS_ORIGINS: ['http://localhost:3000'],
    RATE_LIMIT_WINDOW_MS: 60000,
    RATE_LIMIT_MAX_REQUESTS: 100,
    OTP_RATE_LIMIT_MAX: 3,
    OTP_RATE_LIMIT_WINDOW_MS: 3600000,
  }),
}));

jest.mock('@abroad-matrimony/messaging', () => ({
  listConversations:           jest.fn().mockResolvedValue([]),
  getConversation:             jest.fn().mockResolvedValue({}),
  getConversationMessages:     jest.fn().mockResolvedValue({ messages: [], cursor: null, hasMore: false }),
  sendMessage:                 jest.fn().mockResolvedValue({}),
  getUploadUrl:                jest.fn().mockResolvedValue({ uploadUrl: '', fileUrl: '' }),
  ConversationNotFoundError:   class extends Error { constructor() { super(); this.name = 'ConversationNotFoundError'; } },
  ConversationForbiddenError:  class extends Error { constructor() { super(); this.name = 'ConversationForbiddenError'; } },
  ConversationArchivedError:   class extends Error { constructor() { super(); this.name = 'ConversationArchivedError'; } },
  CONVERSATION_MESSAGES_DEFAULT_LIMIT: 50,
  MessageType: { TEXT: 'TEXT', IMAGE: 'IMAGE', VOICE: 'VOICE', SYSTEM: 'SYSTEM' },
  markConversationRead:        jest.fn().mockResolvedValue(undefined),
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

const app = createApp();

// ── Tests: PAY-001 Stripe checkout ────────────────────────────────────────────

describe('POST /api/v1/payment/stripe/checkout', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 201 with checkoutUrl on success', async () => {
    mockCreateMembershipCheckout.mockResolvedValue({ checkoutUrl: 'https://checkout.stripe.com/test', sessionId: 'cs_test_123' });

    const res = await request(app)
      .post('/api/v1/payment/stripe/checkout')
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.checkoutUrl).toBe('https://checkout.stripe.com/test');
  });

  it('returns 201 with optional email passed through', async () => {
    mockCreateMembershipCheckout.mockResolvedValue({ checkoutUrl: 'https://checkout.stripe.com/test', sessionId: 'cs_test_123' });

    await request(app)
      .post('/api/v1/payment/stripe/checkout')
      .send({ email: 'user@test.com' });

    expect(mockCreateMembershipCheckout).toHaveBeenCalledWith('user-uuid-1', 'user@test.com');
  });

  it('returns 400 when email is not a valid address', async () => {
    const res = await request(app)
      .post('/api/v1/payment/stripe/checkout')
      .send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
  });

  it('returns 500 when service throws an unexpected error', async () => {
    mockCreateMembershipCheckout.mockRejectedValueOnce(new Error('Stripe API down'));
    const res = await request(app).post('/api/v1/payment/stripe/checkout').send({});
    expect(res.status).toBe(500);
  });
});

// ── Tests: PAY-002 Stripe webhook ─────────────────────────────────────────────

describe('POST /api/v1/payment/stripe/webhook', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 { received: true } on valid webhook', async () => {
    mockProcessStripeWebhook.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/v1/payment/stripe/webhook')
      .set('stripe-signature', 'test-sig')
      .set('Content-Type', 'application/json')
      .send(Buffer.from('{}'));

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  it('returns 400 when Stripe-Signature header is missing', async () => {
    const res = await request(app)
      .post('/api/v1/payment/stripe/webhook')
      .send('{}');

    expect(res.status).toBe(400);
  });

  it('returns 401 when PaymentSignatureError is thrown', async () => {
    mockProcessStripeWebhook.mockRejectedValueOnce(new PaymentSignatureError());

    const res = await request(app)
      .post('/api/v1/payment/stripe/webhook')
      .set('stripe-signature', 'bad-sig')
      .set('Content-Type', 'application/json')
      .send(Buffer.from('{}'));

    expect(res.status).toBe(401);
  });
});

// ── Tests: PAY-003 Razorpay order ────────────────────────────────────────────

describe('POST /api/v1/payment/razorpay/order', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 201 with orderId and keyId', async () => {
    mockCreateRazorpayMembershipOrder.mockResolvedValue({ orderId: 'order_test_123', amount: 99900, currency: 'INR', keyId: 'rzp_test_key' });

    const res = await request(app)
      .post('/api/v1/payment/razorpay/order')
      .send({ amountPaise: 99900 });

    expect(res.status).toBe(201);
    expect(res.body.data.orderId).toBe('order_test_123');
    expect(res.body.data.keyId).toBe('rzp_test_key');
  });

  it('returns 400 when amountPaise is missing', async () => {
    const res = await request(app).post('/api/v1/payment/razorpay/order').send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when amountPaise is zero', async () => {
    const res = await request(app).post('/api/v1/payment/razorpay/order').send({ amountPaise: 0 });
    expect(res.status).toBe(400);
  });
});

// ── Tests: PAY-003 Razorpay capture ──────────────────────────────────────────

describe('POST /api/v1/payment/razorpay/capture', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 on valid capture', async () => {
    mockCaptureRazorpayPayment.mockResolvedValue(undefined);

    const res = await request(app)
      .post('/api/v1/payment/razorpay/capture')
      .send({ razorpayOrderId: 'order_123', razorpayPaymentId: 'pay_456', razorpaySignature: 'sig_789' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 400 when signature is invalid', async () => {
    mockCaptureRazorpayPayment.mockRejectedValueOnce(new PaymentSignatureError());

    const res = await request(app)
      .post('/api/v1/payment/razorpay/capture')
      .send({ razorpayOrderId: 'order_123', razorpayPaymentId: 'pay_456', razorpaySignature: 'bad_sig' });

    expect(res.status).toBe(400);
  });

  it('returns 404 when payment is not found', async () => {
    mockCaptureRazorpayPayment.mockRejectedValueOnce(new PaymentNotFoundError());

    const res = await request(app)
      .post('/api/v1/payment/razorpay/capture')
      .send({ razorpayOrderId: 'missing', razorpayPaymentId: 'pay_x', razorpaySignature: 'sig' });

    expect(res.status).toBe(404);
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app).post('/api/v1/payment/razorpay/capture').send({ razorpayOrderId: 'order_123' });
    expect(res.status).toBe(400);
  });
});

// ── Tests: PAY-005 Membership status ─────────────────────────────────────────

describe('GET /api/v1/payment/membership', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with null membership when none exists', async () => {
    mockGetActiveMembership.mockResolvedValue(null);
    const res = await request(app).get('/api/v1/payment/membership');
    expect(res.status).toBe(200);
    expect(res.body.data.membership).toBeNull();
  });

  it('returns 200 with membership DTO when active', async () => {
    mockGetActiveMembership.mockResolvedValue({ id: 'mem-1', plan: 'FOUNDING_MEMBER', status: 'ACTIVE' });
    const res = await request(app).get('/api/v1/payment/membership');
    expect(res.status).toBe(200);
    expect(res.body.data.membership.plan).toBe('FOUNDING_MEMBER');
  });
});

// ── Tests: PAY-006 Diamond purchase ──────────────────────────────────────────

describe('POST /api/v1/payment/diamonds/purchase', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 201 with checkoutUrl for valid packageKey', async () => {
    mockCreateDiamondCheckout.mockResolvedValue({ checkoutUrl: 'https://checkout.stripe.com/diamonds', sessionId: 'cs_d_123' });

    const res = await request(app)
      .post('/api/v1/payment/diamonds/purchase')
      .send({ packageKey: 'DIAMONDS_100' });

    expect(res.status).toBe(201);
    expect(res.body.data.checkoutUrl).toContain('diamonds');
  });

  it('returns 400 for invalid packageKey', async () => {
    mockCreateDiamondCheckout.mockRejectedValueOnce(new InvalidDiamondPackageError());

    const res = await request(app)
      .post('/api/v1/payment/diamonds/purchase')
      .send({ packageKey: 'DIAMONDS_FAKE' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when packageKey is missing', async () => {
    const res = await request(app).post('/api/v1/payment/diamonds/purchase').send({});
    expect(res.status).toBe(400);
  });
});

// ── Tests: PAY-007 Diamond balance ───────────────────────────────────────────

describe('GET /api/v1/payment/diamonds/balance', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with current balance', async () => {
    mockGetDiamondBalance.mockResolvedValue(150);
    const res = await request(app).get('/api/v1/payment/diamonds/balance');
    expect(res.status).toBe(200);
    expect(res.body.data.balance).toBe(150);
  });
});

// ── Tests: PAY-007 Diamond spend ─────────────────────────────────────────────

describe('POST /api/v1/payment/diamonds/spend', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with new balance on valid spend', async () => {
    mockSpendDiamonds.mockResolvedValue(70);

    const res = await request(app)
      .post('/api/v1/payment/diamonds/spend')
      .send({ amount: 30, reason: DiamondReason.FEATURE_UNLOCK });

    expect(res.status).toBe(200);
    expect(res.body.data.balance).toBe(70);
  });

  it('returns 409 when diamonds are insufficient', async () => {
    mockSpendDiamonds.mockRejectedValueOnce(new InsufficientDiamondsError());

    const res = await request(app)
      .post('/api/v1/payment/diamonds/spend')
      .send({ amount: 999, reason: DiamondReason.FEATURE_UNLOCK });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('returns 400 when amount is missing', async () => {
    const res = await request(app)
      .post('/api/v1/payment/diamonds/spend')
      .send({ reason: DiamondReason.FEATURE_UNLOCK });

    expect(res.status).toBe(400);
  });

  it('returns 400 when reason is not a valid DiamondReason', async () => {
    const res = await request(app)
      .post('/api/v1/payment/diamonds/spend')
      .send({ amount: 10, reason: 'INVALID_REASON' });

    expect(res.status).toBe(400);
  });
});
