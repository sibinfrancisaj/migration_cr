import request from 'supertest';
import { createApp } from '../../../app.js';

// ── Service mocks ──────────────────────────────────────────────────────────────

const mockSubmitVerification     = jest.fn();
const mockGetVerificationStatus  = jest.fn();
const mockGetTrustScore          = jest.fn();
const mockGetVerificationUploadUrl = jest.fn();

jest.mock('@abroad-matrimony/verification', () => ({
  submitVerification:              (...a: unknown[]) => mockSubmitVerification(...a),
  getVerificationStatus:           (...a: unknown[]) => mockGetVerificationStatus(...a),
  getTrustScore:                   (...a: unknown[]) => mockGetTrustScore(...a),
  getVerificationUploadUrl:        (...a: unknown[]) => mockGetVerificationUploadUrl(...a),
  VerificationAlreadySubmittedError: class extends Error { constructor() { super('ALREADY_SUBMITTED'); this.name = 'VerificationAlreadySubmittedError'; } },
}));

jest.mock('@abroad-matrimony/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-uuid-1', role: 'USER', deviceId: 'device-uuid-1' };
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
  DeviceNotTrustedError:       class extends Error { constructor() { super(); this.name = 'DeviceNotTrustedError'; } },
  sendMagicLink:               jest.fn().mockResolvedValue({}),
  verifyMagicLink:             jest.fn().mockResolvedValue({}),
  MagicLinkUserNotFoundError:  class extends Error { constructor() { super(); this.name = 'MagicLinkUserNotFoundError'; } },
  MagicLinkInvalidError:       class extends Error { constructor() { super(); this.name = 'MagicLinkInvalidError'; } },
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

jest.mock('@abroad-matrimony/payment', () => ({
  createMembershipCheckout:      jest.fn().mockResolvedValue({ checkoutUrl: '' }),
  createDiamondCheckout:         jest.fn().mockResolvedValue({ checkoutUrl: '' }),
  createRazorpayMembershipOrder: jest.fn().mockResolvedValue({}),
  captureRazorpayPayment:        jest.fn().mockResolvedValue(undefined),
  processStripeWebhook:          jest.fn().mockResolvedValue(undefined),
  processRazorpayWebhook:        jest.fn().mockResolvedValue(undefined),
  getActiveMembership:           jest.fn().mockResolvedValue(null),
  getDiamondBalance:             jest.fn().mockResolvedValue(0),
  spendDiamonds:                 jest.fn().mockResolvedValue(undefined),
  markPaymentRefunded:           jest.fn().mockResolvedValue(undefined),
  refundDiamonds:                jest.fn().mockResolvedValue(undefined),
  getCreditTransactions:         jest.fn().mockResolvedValue([]),
  DIAMOND_PACKAGES: {},
  PaymentSignatureError:         class extends Error { constructor() { super(); this.name = 'PaymentSignatureError'; } },
  PaymentNotFoundError:          class extends Error { constructor() { super(); this.name = 'PaymentNotFoundError'; } },
  InvalidDiamondPackageError:    class extends Error { constructor() { super(); this.name = 'InvalidDiamondPackageError'; } },
  InsufficientDiamondsError:     class extends Error { constructor() { super(); this.name = 'InsufficientDiamondsError'; } },
  MembershipAlreadyActiveError:  class extends Error { constructor() { super(); this.name = 'MembershipAlreadyActiveError'; } },
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const verMock = jest.requireMock('@abroad-matrimony/verification') as any;
const VerificationAlreadySubmittedError = verMock.VerificationAlreadySubmittedError as typeof Error;

const app = createApp();

// ── Fixtures ───────────────────────────────────────────────────────────────────

const USER_ID = 'user-uuid-1';

const VERIFICATION_DTO = {
  id: 'ver-uuid-1',
  userId: USER_ID,
  status: 'PENDING',
  idDocType: 'PASSPORT',
  idDocS3Key: 'verifications/user-uuid-1/id-doc.jpg',
  selfieS3Key: 'verifications/user-uuid-1/selfie.jpg',
  submittedAt: new Date().toISOString(),
};

// ── GET /api/v1/verification/upload-url ───────────────────────────────────────

describe('GET /api/v1/verification/upload-url', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with upload URL and s3Key', async () => {
    mockGetVerificationUploadUrl.mockResolvedValue({
      uploadUrl: 'https://s3.example.com/presigned',
      s3Key: 'verifications/user-uuid-1/id-doc.jpg',
    });

    const res = await request(app)
      .get('/api/v1/verification/upload-url?fileType=id_document&mimeType=image/jpeg');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.uploadUrl).toBe('https://s3.example.com/presigned');
  });

  it('returns 400 when fileType is missing', async () => {
    const res = await request(app).get('/api/v1/verification/upload-url?mimeType=image/jpeg');
    expect(res.status).toBe(400);
  });

  it('returns 400 when mimeType is invalid', async () => {
    const res = await request(app)
      .get('/api/v1/verification/upload-url?fileType=id_document&mimeType=image/gif');
    expect(res.status).toBe(400);
  });

  it('returns 400 when fileType is invalid', async () => {
    const res = await request(app)
      .get('/api/v1/verification/upload-url?fileType=video&mimeType=image/jpeg');
    expect(res.status).toBe(400);
  });

  it('returns 500 when service throws unexpected error', async () => {
    mockGetVerificationUploadUrl.mockRejectedValueOnce(new Error('S3 error'));

    const res = await request(app)
      .get('/api/v1/verification/upload-url?fileType=selfie&mimeType=image/png');
    expect(res.status).toBe(500);
  });
});

// ── POST /api/v1/verification ─────────────────────────────────────────────────

describe('POST /api/v1/verification', () => {
  beforeEach(() => jest.clearAllMocks());

  const validBody = {
    idDocType:   'PASSPORT',
    idDocS3Key:  'verifications/user-uuid-1/id-doc.jpg',
    selfieS3Key: 'verifications/user-uuid-1/selfie.jpg',
  };

  it('returns 201 with verification DTO on success', async () => {
    mockSubmitVerification.mockResolvedValue(VERIFICATION_DTO);

    const res = await request(app).post('/api/v1/verification').send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('PENDING');
  });

  it('returns 409 when already submitted', async () => {
    mockSubmitVerification.mockRejectedValueOnce(new VerificationAlreadySubmittedError());

    const res = await request(app).post('/api/v1/verification').send(validBody);
    expect(res.status).toBe(409);
  });

  it('returns 400 when idDocType is missing', async () => {
    const res = await request(app).post('/api/v1/verification').send({
      idDocS3Key: 'key.jpg', selfieS3Key: 'selfie.jpg',
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when idDocType is invalid', async () => {
    const res = await request(app).post('/api/v1/verification').send({
      ...validBody, idDocType: 'BIRTH_CERTIFICATE',
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 when selfieS3Key is missing', async () => {
    const res = await request(app).post('/api/v1/verification').send({
      idDocType: 'PASSPORT', idDocS3Key: 'key.jpg',
    });
    expect(res.status).toBe(400);
  });
});

// ── GET /api/v1/verification/status ───────────────────────────────────────────

describe('GET /api/v1/verification/status', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with verification status', async () => {
    mockGetVerificationStatus.mockResolvedValue({ status: 'APPROVED', trustScore: 85 });

    const res = await request(app).get('/api/v1/verification/status');

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('APPROVED');
  });

  it('returns 200 with null when no verification exists', async () => {
    mockGetVerificationStatus.mockResolvedValue(null);

    const res = await request(app).get('/api/v1/verification/status');
    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
  });

  it('returns 500 when service throws unexpected error', async () => {
    mockGetVerificationStatus.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app).get('/api/v1/verification/status');
    expect(res.status).toBe(500);
  });
});

// ── GET /api/v1/verification/trust-score ──────────────────────────────────────

describe('GET /api/v1/verification/trust-score', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with trust score breakdown', async () => {
    mockGetTrustScore.mockResolvedValue({
      total: 72,
      breakdown: { identity: 40, profile: 20, activity: 12 },
    });

    const res = await request(app).get('/api/v1/verification/trust-score');

    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(72);
  });

  it('returns 500 when service throws unexpected error', async () => {
    mockGetTrustScore.mockRejectedValueOnce(new Error('Unexpected'));

    const res = await request(app).get('/api/v1/verification/trust-score');
    expect(res.status).toBe(500);
  });
});
