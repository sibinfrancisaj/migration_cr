import request from 'supertest';
import { createApp } from '../../../app.js';

// ── Service mocks ──────────────────────────────────────────────────────────────

const mockToggleProfilePause    = jest.fn();
const mockGetVoiceIntroUploadUrl = jest.fn();
const mockSaveVoiceIntro        = jest.fn();

jest.mock('@abroad-matrimony/profile', () => ({
  // Extensions
  toggleProfilePause:       (...a: unknown[]) => mockToggleProfilePause(...a),
  getVoiceIntroUploadUrl:   (...a: unknown[]) => mockGetVoiceIntroUploadUrl(...a),
  saveVoiceIntro:           (...a: unknown[]) => mockSaveVoiceIntro(...a),
  ProfileNotFoundError:     class extends Error { constructor() { super('NOT_FOUND'); this.name = 'ProfileNotFoundError'; } },
  // Existing profile functions (used by other routes)
  createProfile:            jest.fn().mockResolvedValue({}),
  upsertRealLifeAnswer:     jest.fn().mockResolvedValue({}),
  upsertStoryPrompt:        jest.fn().mockResolvedValue({}),
  uploadProfilePhoto:       jest.fn().mockResolvedValue({}),
  getOwnProfile:            jest.fn().mockResolvedValue({}),
  getProfile:               jest.fn().mockResolvedValue({}),
  ProfileAlreadyExistsError: class extends Error { constructor() { super(); this.name = 'ProfileAlreadyExistsError'; } },
}));

// ── Standard gateway mocks ─────────────────────────────────────────────────────

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
  DeviceNotTrustedError:       class extends Error { constructor() { super('DEVICE_NOT_TRUSTED'); this.name = 'DeviceNotTrustedError'; } },
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
  listConversations: jest.fn().mockResolvedValue([]),
  getConversation: jest.fn().mockResolvedValue({}),
  getConversationMessages: jest.fn().mockResolvedValue({ messages: [], cursor: null }),
  sendMessage: jest.fn().mockResolvedValue({}),
  getUploadUrl: jest.fn().mockResolvedValue({ uploadUrl: '', fileUrl: '' }),
  ConversationNotFoundError:   class extends Error { constructor() { super(); this.name = 'ConversationNotFoundError'; } },
  ConversationForbiddenError:  class extends Error { constructor() { super(); this.name = 'ConversationForbiddenError'; } },
  ConversationArchivedError:   class extends Error { constructor() { super(); this.name = 'ConversationArchivedError'; } },
  CONVERSATION_MESSAGES_DEFAULT_LIMIT: 50,
  MessageType: { TEXT: 'TEXT', IMAGE: 'IMAGE', VOICE: 'VOICE', SYSTEM: 'SYSTEM' },
  markConversationRead: jest.fn().mockResolvedValue(undefined),
  MessageNotFoundForReadError: class extends Error { constructor() { super(); this.name = 'MessageNotFoundForReadError'; } },
  createFirebaseToken: jest.fn().mockResolvedValue('mock-firebase-token'),
  FirebaseNotConfiguredError:  class extends Error { constructor() { super(); this.name = 'FirebaseNotConfiguredError'; } },
  flagMessage: jest.fn().mockResolvedValue({ id: 'flag-1', status: 'OPEN' }),
  MessageNotFoundError:        class extends Error { constructor() { super(); this.name = 'MessageNotFoundError'; } },
  AlreadyFlaggedError:         class extends Error { constructor() { super(); this.name = 'AlreadyFlaggedError'; } },
  FlagSelfError:               class extends Error { constructor() { super(); this.name = 'FlagSelfError'; } },
  getAdminFlagSummary: jest.fn().mockResolvedValue({ flags: [], total: 0 }),
  resolveFlag: jest.fn().mockResolvedValue({ id: 'flag-1', status: 'RESOLVED' }),
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
const profileMock = jest.requireMock('@abroad-matrimony/profile') as any;
const ProfileNotFoundError = profileMock.ProfileNotFoundError as typeof Error;

const app = createApp();

const USER_ID = 'user-uuid-1';

// ── PUT /api/v1/profile/pause ─────────────────────────────────────────────────

describe('PUT /api/v1/profile/pause', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with isPaused=true when pausing', async () => {
    mockToggleProfilePause.mockResolvedValue({ userId: USER_ID, isPaused: true });

    const res = await request(app).put('/api/v1/profile/pause');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isPaused).toBe(true);
    expect(res.body.meta.message).toMatch(/paused/i);
    expect(mockToggleProfilePause).toHaveBeenCalledWith(USER_ID);
  });

  it('returns 200 with isPaused=false when unpausing', async () => {
    mockToggleProfilePause.mockResolvedValue({ userId: USER_ID, isPaused: false });

    const res = await request(app).put('/api/v1/profile/pause');

    expect(res.status).toBe(200);
    expect(res.body.data.isPaused).toBe(false);
    expect(res.body.meta.message).toMatch(/unpaused/i);
  });

  it('returns 404 when profile does not exist', async () => {
    mockToggleProfilePause.mockRejectedValueOnce(new ProfileNotFoundError());

    const res = await request(app).put('/api/v1/profile/pause');
    expect(res.status).toBe(404);
  });

  it('returns 500 when service throws unexpected error', async () => {
    mockToggleProfilePause.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app).put('/api/v1/profile/pause');
    expect(res.status).toBe(500);
  });
});

// ── POST /api/v1/profile/voice-intro/upload-url ───────────────────────────────

describe('POST /api/v1/profile/voice-intro/upload-url', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with upload URL', async () => {
    mockGetVoiceIntroUploadUrl.mockResolvedValue({
      uploadUrl: 'https://s3.example.com/signed-url',
      s3Key: 'voice-intros/user-uuid-1/abc.webm',
    });

    const res = await request(app)
      .post('/api/v1/profile/voice-intro/upload-url')
      .send({ mimeType: 'audio/webm' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.uploadUrl).toContain('s3.example.com');
    expect(mockGetVoiceIntroUploadUrl).toHaveBeenCalledWith(USER_ID, 'audio/webm');
  });

  it('returns 400 when mimeType is missing', async () => {
    const res = await request(app)
      .post('/api/v1/profile/voice-intro/upload-url')
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when mimeType is not an audio type', async () => {
    const res = await request(app)
      .post('/api/v1/profile/voice-intro/upload-url')
      .send({ mimeType: 'image/jpeg' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when profile does not exist', async () => {
    mockGetVoiceIntroUploadUrl.mockRejectedValueOnce(new ProfileNotFoundError());

    const res = await request(app)
      .post('/api/v1/profile/voice-intro/upload-url')
      .send({ mimeType: 'audio/mpeg' });
    expect(res.status).toBe(404);
  });

  it('returns 500 when service throws unexpected error', async () => {
    mockGetVoiceIntroUploadUrl.mockRejectedValueOnce(new Error('S3 error'));

    const res = await request(app)
      .post('/api/v1/profile/voice-intro/upload-url')
      .send({ mimeType: 'audio/mpeg' });
    expect(res.status).toBe(500);
  });
});

// ── POST /api/v1/profile/voice-intro ─────────────────────────────────────────

describe('POST /api/v1/profile/voice-intro', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 201 with saved voice intro', async () => {
    const voiceDto = { userId: USER_ID, voiceIntroUrl: 'https://cdn.example.com/vi/abc.webm' };
    mockSaveVoiceIntro.mockResolvedValue(voiceDto);

    const res = await request(app)
      .post('/api/v1/profile/voice-intro')
      .send({ s3Key: 'voice-intros/user-uuid-1/abc.webm' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.voiceIntroUrl).toContain('cdn.example.com');
    expect(mockSaveVoiceIntro).toHaveBeenCalledWith(USER_ID, 'voice-intros/user-uuid-1/abc.webm');
  });

  it('returns 400 when s3Key is missing', async () => {
    const res = await request(app)
      .post('/api/v1/profile/voice-intro')
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when s3Key is empty string', async () => {
    const res = await request(app)
      .post('/api/v1/profile/voice-intro')
      .send({ s3Key: '' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when profile does not exist', async () => {
    mockSaveVoiceIntro.mockRejectedValueOnce(new ProfileNotFoundError());

    const res = await request(app)
      .post('/api/v1/profile/voice-intro')
      .send({ s3Key: 'voice-intros/user-uuid-1/abc.webm' });
    expect(res.status).toBe(404);
  });

  it('returns 500 when service throws unexpected error', async () => {
    mockSaveVoiceIntro.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app)
      .post('/api/v1/profile/voice-intro')
      .send({ s3Key: 'voice-intros/user-uuid-1/abc.webm' });
    expect(res.status).toBe(500);
  });
});
