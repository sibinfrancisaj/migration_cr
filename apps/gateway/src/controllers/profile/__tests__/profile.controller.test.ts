import request from 'supertest';
import { createApp } from '../../../app.js';
import { Gender, RealLifeQuestionKey, StoryPromptKey, VerificationStatus } from '@abroad-matrimony/shared';

// ── Service mocks ─────────────────────────────────────────────────────────────

const mockCreateProfileService  = jest.fn();
const mockUpsertRealLifeAnswer  = jest.fn();
const mockUpsertStoryPrompt     = jest.fn();
const mockGetOwnProfile         = jest.fn();
const mockGetProfileById        = jest.fn();
const mockUploadProfilePhoto    = jest.fn();

// ── Mock @abroad-matrimony/profile ────────────────────────────────────────────
// Error classes are defined inside the factory so instanceof checks work.

jest.mock('@abroad-matrimony/profile', () => {
  class ProfileAlreadyExistsError extends Error {
    constructor() { super('PROFILE_ALREADY_EXISTS'); this.name = 'ProfileAlreadyExistsError'; }
  }
  class ProfileNotFoundError extends Error {
    constructor() { super('PROFILE_NOT_FOUND'); this.name = 'ProfileNotFoundError'; }
  }
  class PhotoLimitExceededError extends Error {
    constructor() { super('PHOTO_LIMIT_EXCEEDED'); this.name = 'PhotoLimitExceededError'; }
  }
  class InvalidMimeTypeError extends Error {
    constructor() { super('INVALID_MIME_TYPE'); this.name = 'InvalidMimeTypeError'; }
  }
  return {
    createProfileService:  (...args: unknown[]) => mockCreateProfileService(...args),
    ProfileAlreadyExistsError,
    upsertRealLifeAnswer:  (...args: unknown[]) => mockUpsertRealLifeAnswer(...args),
    upsertStoryPrompt:     (...args: unknown[]) => mockUpsertStoryPrompt(...args),
    getOwnProfile:         (...args: unknown[]) => mockGetOwnProfile(...args),
    getProfileById:        (...args: unknown[]) => mockGetProfileById(...args),
    uploadProfilePhoto:    (...args: unknown[]) => mockUploadProfilePhoto(...args),
    ProfileNotFoundError,
    PhotoLimitExceededError,
    InvalidMimeTypeError,
  };
});

const getProfileErrors = () =>
  jest.requireMock('@abroad-matrimony/profile') as {
    ProfileAlreadyExistsError: new () => Error;
    ProfileNotFoundError:      new () => Error;
    PhotoLimitExceededError:   new () => Error;
    InvalidMimeTypeError:      new () => Error;
  };

// ── Mock @abroad-matrimony/auth ───────────────────────────────────────────────
// requireAuth behaviour is controlled via a closure variable so it can be
// flipped per-test without recreating the app.

let requireAuthBehavior: 'pass' | 'fail401' = 'pass';

jest.mock('@abroad-matrimony/auth', () => ({
  requireAuth: (req: any, res: any, next: any) => {
    if (requireAuthBehavior === 'fail401') {
      return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required.' } });
    }
    req.user = { id: 'user-uuid-1', role: 'USER', deviceId: 'device-uuid-1' };
    next();
  },
  // Stubs for other exports the app module imports
  checkAndIncrOtpRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
  getOtpAdapter: jest.fn().mockReturnValue({ send: jest.fn().mockResolvedValue(undefined) }),
  otpVerifyService:    jest.fn().mockResolvedValue({}),
  tokenRefreshService: jest.fn().mockResolvedValue({}),
  revokeForDevice:     jest.fn().mockResolvedValue(undefined),
  revokeAllForUser:    jest.fn().mockResolvedValue(undefined),
  OtpInvalidError:   class OtpInvalidError   extends Error { constructor() { super(); this.name = 'OtpInvalidError'; } },
  DeviceLimitError:  class DeviceLimitError   extends Error { constructor() { super(); this.name = 'DeviceLimitError'; } },
  TokenInvalidError: class TokenInvalidError  extends Error { constructor() { super(); this.name = 'TokenInvalidError'; } },
  TokenReuseError:   class TokenReuseError    extends Error { constructor() { super(); this.name = 'TokenReuseError'; } },
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
    RATE_LIMIT_WINDOW_MS:    60000,
    RATE_LIMIT_MAX_REQUESTS: 100,
    OTP_RATE_LIMIT_MAX:      3,
    OTP_RATE_LIMIT_WINDOW_MS: 3600000,
  }),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const VALID_BODY = {
  name: 'Priya Sharma',
  dateOfBirth: '1990-05-15',
  gender: 'FEMALE',
  currentCity: 'London',
  currentCountry: 'United Kingdom',
  settlementIntent: 'UK or Canada',
  bio: 'Software engineer who loves hiking.',
};

const PROFILE_RESULT = {
  id: 'profile-uuid-1',
  userId: 'user-uuid-1',
  name: 'Priya Sharma',
  dateOfBirth: new Date('1990-05-15').toISOString(),
  gender: Gender.FEMALE,
  currentCity: 'London',
  currentCountry: 'United Kingdom',
  settlementIntent: 'UK or Canada',
  bio: 'Software engineer who loves hiking.',
  completionScore: 0,
  verificationStatus: VerificationStatus.PENDING,
  isVerified: false,
  photos: [],
  realLifeAnswers: [],
  storyPrompts: [],
  createdAt: new Date('2026-05-27T10:00:00.000Z').toISOString(),
  updatedAt: new Date('2026-05-27T10:00:00.000Z').toISOString(),
};

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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/v1/profile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAuthBehavior = 'pass';
    mockCreateProfileService.mockResolvedValue(PROFILE_RESULT);
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it('returns 201 with profile data on valid body', async () => {
    const res = await request(app).post('/api/v1/profile').send(VALID_BODY);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('profile-uuid-1');
    expect(res.body.data.name).toBe('Priya Sharma');
    expect(res.body.data.gender).toBe('FEMALE');
    expect(res.body.data.photos).toEqual([]);
    expect(res.body.data.realLifeAnswers).toEqual([]);
  });

  it('returns 201 when bio is omitted (bio is optional)', async () => {
    const { bio: _bio, ...bodyWithoutBio } = VALID_BODY;
    const res = await request(app).post('/api/v1/profile').send(bodyWithoutBio);

    expect(res.status).toBe(201);
  });

  it('passes userId from req.user to the service', async () => {
    await request(app).post('/api/v1/profile').send(VALID_BODY);

    expect(mockCreateProfileService).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-uuid-1' }),
    );
  });

  it('coerces dateOfBirth string to a Date before calling the service', async () => {
    await request(app).post('/api/v1/profile').send(VALID_BODY);

    const serviceArg = mockCreateProfileService.mock.calls[0][0];
    expect(serviceArg.dateOfBirth).toBeInstanceOf(Date);
  });

  it('propagates X-Request-ID through the response', async () => {
    const res = await request(app)
      .post('/api/v1/profile')
      .set('X-Request-ID', 'profile-test-1234')
      .send(VALID_BODY);

    expect(res.headers['x-request-id']).toBe('profile-test-1234');
    expect(res.body.requestId).toBe('profile-test-1234');
  });

  // ── Validation errors — name ──────────────────────────────────────────────

  it('returns 400 when name is missing', async () => {
    const { name: _name, ...body } = VALID_BODY;
    const res = await request(app).post('/api/v1/profile').send(body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockCreateProfileService).not.toHaveBeenCalled();
  });

  it('returns 400 when name is less than 2 characters', async () => {
    const res = await request(app).post('/api/v1/profile').send({ ...VALID_BODY, name: 'A' });

    expect(res.status).toBe(400);
    expect(mockCreateProfileService).not.toHaveBeenCalled();
  });

  // ── Validation errors — dateOfBirth ──────────────────────────────────────

  it('returns 400 when dateOfBirth is missing', async () => {
    const { dateOfBirth: _dob, ...body } = VALID_BODY;
    const res = await request(app).post('/api/v1/profile').send(body);

    expect(res.status).toBe(400);
    expect(mockCreateProfileService).not.toHaveBeenCalled();
  });

  it('returns 400 when dateOfBirth is not a valid date string', async () => {
    const res = await request(app)
      .post('/api/v1/profile')
      .send({ ...VALID_BODY, dateOfBirth: 'not-a-date' });

    expect(res.status).toBe(400);
    expect(mockCreateProfileService).not.toHaveBeenCalled();
  });

  it('returns 400 when user is under 18 years old', async () => {
    // 2015-01-01 is only 11 years old as of 2026
    const res = await request(app)
      .post('/api/v1/profile')
      .send({ ...VALID_BODY, dateOfBirth: '2015-01-01' });

    expect(res.status).toBe(400);
    expect(mockCreateProfileService).not.toHaveBeenCalled();
  });

  // ── Validation errors — gender ────────────────────────────────────────────

  it('returns 400 when gender is missing', async () => {
    const { gender: _gender, ...body } = VALID_BODY;
    const res = await request(app).post('/api/v1/profile').send(body);

    expect(res.status).toBe(400);
    expect(mockCreateProfileService).not.toHaveBeenCalled();
  });

  it('returns 400 when gender is not a valid enum value', async () => {
    const res = await request(app)
      .post('/api/v1/profile')
      .send({ ...VALID_BODY, gender: 'INVALID_GENDER' });

    expect(res.status).toBe(400);
    expect(mockCreateProfileService).not.toHaveBeenCalled();
  });

  // ── Validation errors — location / settlementIntent ───────────────────────

  it('returns 400 when currentCity is missing', async () => {
    const { currentCity: _city, ...body } = VALID_BODY;
    const res = await request(app).post('/api/v1/profile').send(body);

    expect(res.status).toBe(400);
    expect(mockCreateProfileService).not.toHaveBeenCalled();
  });

  it('returns 400 when currentCountry is missing', async () => {
    const { currentCountry: _country, ...body } = VALID_BODY;
    const res = await request(app).post('/api/v1/profile').send(body);

    expect(res.status).toBe(400);
    expect(mockCreateProfileService).not.toHaveBeenCalled();
  });

  it('returns 400 when settlementIntent is missing', async () => {
    const { settlementIntent: _si, ...body } = VALID_BODY;
    const res = await request(app).post('/api/v1/profile').send(body);

    expect(res.status).toBe(400);
    expect(mockCreateProfileService).not.toHaveBeenCalled();
  });

  // ── Auth error ────────────────────────────────────────────────────────────

  it('returns 401 when requireAuth rejects the request', async () => {
    requireAuthBehavior = 'fail401';

    const res = await request(app).post('/api/v1/profile').send(VALID_BODY);

    expect(res.status).toBe(401);
    expect(mockCreateProfileService).not.toHaveBeenCalled();
  });

  // ── Domain errors ─────────────────────────────────────────────────────────

  it('returns 409 CONFLICT when profile already exists', async () => {
    const { ProfileAlreadyExistsError } = getProfileErrors();
    mockCreateProfileService.mockRejectedValueOnce(new ProfileAlreadyExistsError());

    const res = await request(app).post('/api/v1/profile').send(VALID_BODY);

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  // ── Unexpected error ──────────────────────────────────────────────────────

  it('returns 500 when createProfileService throws an unexpected error', async () => {
    mockCreateProfileService.mockRejectedValueOnce(new Error('DB down'));

    const res = await request(app).post('/api/v1/profile').send(VALID_BODY);

    expect(res.status).toBe(500);
  });
});

// ── PUT /api/v1/profile/real-life/:questionKey ────────────────────────────────

const ANSWER_RESULT = {
  questionKey: RealLifeQuestionKey.DIET,
  value:       'Vegetarian',
  updatedAt:   new Date('2026-05-27T10:00:00.000Z').toISOString(),
};

describe('PUT /api/v1/profile/real-life/:questionKey', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAuthBehavior = 'pass';
    mockUpsertRealLifeAnswer.mockResolvedValue(ANSWER_RESULT);
  });

  // ── Happy path — string value ─────────────────────────────────────────────

  it('returns 200 with RealLifeAnswerDto for a valid questionKey and string value', async () => {
    const res = await request(app)
      .put('/api/v1/profile/real-life/DIET')
      .send({ value: 'Vegetarian' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.questionKey).toBe(RealLifeQuestionKey.DIET);
    expect(res.body.data.value).toBe('Vegetarian');
  });

  // ── Happy path — array value ──────────────────────────────────────────────

  it('returns 200 with array value when value is an array of strings', async () => {
    mockUpsertRealLifeAnswer.mockResolvedValueOnce({
      ...ANSWER_RESULT,
      questionKey: RealLifeQuestionKey.KIDS,
      value: ['Yes', '2 children'],
    });

    const res = await request(app)
      .put('/api/v1/profile/real-life/KIDS')
      .send({ value: ['Yes', '2 children'] });

    expect(res.status).toBe(200);
    expect(res.body.data.value).toEqual(['Yes', '2 children']);
  });

  // ── Service call verification ─────────────────────────────────────────────

  it('passes userId from req.user and questionKey from params to the service', async () => {
    await request(app)
      .put('/api/v1/profile/real-life/DIET')
      .send({ value: 'Vegetarian' });

    expect(mockUpsertRealLifeAnswer).toHaveBeenCalledWith(
      expect.objectContaining({
        userId:      'user-uuid-1',
        questionKey: RealLifeQuestionKey.DIET,
        value:       'Vegetarian',
      }),
    );
  });

  it('propagates X-Request-ID through the response', async () => {
    const res = await request(app)
      .put('/api/v1/profile/real-life/DIET')
      .set('X-Request-ID', 'rl-test-5678')
      .send({ value: 'Vegetarian' });

    expect(res.headers['x-request-id']).toBe('rl-test-5678');
    expect(res.body.requestId).toBe('rl-test-5678');
  });

  // ── Auth error ────────────────────────────────────────────────────────────

  it('returns 401 when requireAuth rejects the request', async () => {
    requireAuthBehavior = 'fail401';

    const res = await request(app)
      .put('/api/v1/profile/real-life/DIET')
      .send({ value: 'Vegetarian' });

    expect(res.status).toBe(401);
    expect(mockUpsertRealLifeAnswer).not.toHaveBeenCalled();
  });

  // ── Param validation errors ───────────────────────────────────────────────

  it('returns 400 VALIDATION_ERROR when questionKey is not a valid enum value', async () => {
    const res = await request(app)
      .put('/api/v1/profile/real-life/INVALID_KEY')
      .send({ value: 'Vegetarian' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockUpsertRealLifeAnswer).not.toHaveBeenCalled();
  });

  // ── Body validation errors ────────────────────────────────────────────────

  it('returns 400 VALIDATION_ERROR when value is missing from the body', async () => {
    const res = await request(app)
      .put('/api/v1/profile/real-life/DIET')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockUpsertRealLifeAnswer).not.toHaveBeenCalled();
  });

  it('returns 400 VALIDATION_ERROR when value is an empty string', async () => {
    const res = await request(app)
      .put('/api/v1/profile/real-life/DIET')
      .send({ value: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockUpsertRealLifeAnswer).not.toHaveBeenCalled();
  });

  it('returns 400 VALIDATION_ERROR when value is an empty array', async () => {
    const res = await request(app)
      .put('/api/v1/profile/real-life/DIET')
      .send({ value: [] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockUpsertRealLifeAnswer).not.toHaveBeenCalled();
  });

  it('returns 400 VALIDATION_ERROR when string value exceeds 500 characters', async () => {
    const res = await request(app)
      .put('/api/v1/profile/real-life/DIET')
      .send({ value: 'A'.repeat(501) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockUpsertRealLifeAnswer).not.toHaveBeenCalled();
  });

  it('returns 400 VALIDATION_ERROR when an array item exceeds 200 characters', async () => {
    const res = await request(app)
      .put('/api/v1/profile/real-life/DIET')
      .send({ value: ['A'.repeat(201)] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockUpsertRealLifeAnswer).not.toHaveBeenCalled();
  });

  it('returns 400 VALIDATION_ERROR when value is a number (wrong type)', async () => {
    const res = await request(app)
      .put('/api/v1/profile/real-life/DIET')
      .send({ value: 42 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockUpsertRealLifeAnswer).not.toHaveBeenCalled();
  });

  // ── Domain errors ─────────────────────────────────────────────────────────

  it('returns 404 NOT_FOUND when ProfileNotFoundError is thrown', async () => {
    const { ProfileNotFoundError } = getProfileErrors();
    mockUpsertRealLifeAnswer.mockRejectedValueOnce(new ProfileNotFoundError());

    const res = await request(app)
      .put('/api/v1/profile/real-life/DIET')
      .send({ value: 'Vegetarian' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  // ── Unexpected error ──────────────────────────────────────────────────────

  it('returns 500 when upsertRealLifeAnswer throws an unexpected error', async () => {
    mockUpsertRealLifeAnswer.mockRejectedValueOnce(new Error('DB down'));

    const res = await request(app)
      .put('/api/v1/profile/real-life/DIET')
      .send({ value: 'Vegetarian' });

    expect(res.status).toBe(500);
  });
});

// ── PUT /api/v1/profile/story/:promptKey ─────────────────────────────────────

const STORY_ANSWER_RESULT = {
  promptKey: StoryPromptKey.DEAL_BREAKER,
  answer:    'Dishonesty is my biggest deal breaker in a relationship.',
  updatedAt: new Date('2026-05-27T10:00:00.000Z').toISOString(),
};

describe('PUT /api/v1/profile/story/:promptKey', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAuthBehavior = 'pass';
    mockUpsertStoryPrompt.mockResolvedValue(STORY_ANSWER_RESULT);
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it('returns 200 with StoryPromptAnswerDto for a valid promptKey and answer', async () => {
    const res = await request(app)
      .put('/api/v1/profile/story/DEAL_BREAKER')
      .send({ answer: 'Dishonesty is my biggest deal breaker.' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.promptKey).toBe(StoryPromptKey.DEAL_BREAKER);
    expect(res.body.data.answer).toBe('Dishonesty is my biggest deal breaker in a relationship.');
  });

  it('returns 200 for each of the 3 valid StoryPromptKey values', async () => {
    for (const key of Object.values(StoryPromptKey)) {
      mockUpsertStoryPrompt.mockResolvedValueOnce({ ...STORY_ANSWER_RESULT, promptKey: key });

      const res = await request(app)
        .put(`/api/v1/profile/story/${key}`)
        .send({ answer: 'My answer for this prompt.' });

      expect(res.status).toBe(200);
      expect(res.body.data.promptKey).toBe(key);
    }
  });

  // ── Service call verification ─────────────────────────────────────────────

  it('passes userId from req.user and promptKey from params to the service', async () => {
    await request(app)
      .put('/api/v1/profile/story/DEAL_BREAKER')
      .send({ answer: 'Dishonesty.' });

    expect(mockUpsertStoryPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        userId:    'user-uuid-1',
        promptKey: StoryPromptKey.DEAL_BREAKER,
        answer:    'Dishonesty.',
      }),
    );
  });

  it('propagates X-Request-ID through the response', async () => {
    const res = await request(app)
      .put('/api/v1/profile/story/DEAL_BREAKER')
      .set('X-Request-ID', 'story-test-9999')
      .send({ answer: 'Dishonesty.' });

    expect(res.headers['x-request-id']).toBe('story-test-9999');
    expect(res.body.requestId).toBe('story-test-9999');
  });

  // ── Auth error ────────────────────────────────────────────────────────────

  it('returns 401 when requireAuth rejects the request', async () => {
    requireAuthBehavior = 'fail401';

    const res = await request(app)
      .put('/api/v1/profile/story/DEAL_BREAKER')
      .send({ answer: 'Dishonesty.' });

    expect(res.status).toBe(401);
    expect(mockUpsertStoryPrompt).not.toHaveBeenCalled();
  });

  // ── Param validation errors ───────────────────────────────────────────────

  it('returns 400 VALIDATION_ERROR when promptKey is not a valid enum value', async () => {
    const res = await request(app)
      .put('/api/v1/profile/story/INVALID_PROMPT')
      .send({ answer: 'Some answer.' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockUpsertStoryPrompt).not.toHaveBeenCalled();
  });

  // ── Body validation errors ────────────────────────────────────────────────

  it('returns 400 VALIDATION_ERROR when answer is missing from the body', async () => {
    const res = await request(app)
      .put('/api/v1/profile/story/DEAL_BREAKER')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockUpsertStoryPrompt).not.toHaveBeenCalled();
  });

  it('returns 400 VALIDATION_ERROR when answer is an empty string', async () => {
    const res = await request(app)
      .put('/api/v1/profile/story/DEAL_BREAKER')
      .send({ answer: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockUpsertStoryPrompt).not.toHaveBeenCalled();
  });

  it('returns 400 VALIDATION_ERROR when answer exceeds 1000 characters', async () => {
    const res = await request(app)
      .put('/api/v1/profile/story/DEAL_BREAKER')
      .send({ answer: 'A'.repeat(1001) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockUpsertStoryPrompt).not.toHaveBeenCalled();
  });

  it('returns 400 VALIDATION_ERROR when answer is not a string', async () => {
    const res = await request(app)
      .put('/api/v1/profile/story/DEAL_BREAKER')
      .send({ answer: 42 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockUpsertStoryPrompt).not.toHaveBeenCalled();
  });

  // ── Domain errors ─────────────────────────────────────────────────────────

  it('returns 404 NOT_FOUND when ProfileNotFoundError is thrown', async () => {
    const { ProfileNotFoundError } = getProfileErrors();
    mockUpsertStoryPrompt.mockRejectedValueOnce(new ProfileNotFoundError());

    const res = await request(app)
      .put('/api/v1/profile/story/DEAL_BREAKER')
      .send({ answer: 'Dishonesty.' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  // ── Unexpected error ──────────────────────────────────────────────────────

  it('returns 500 when upsertStoryPrompt throws an unexpected error', async () => {
    mockUpsertStoryPrompt.mockRejectedValueOnce(new Error('DB down'));

    const res = await request(app)
      .put('/api/v1/profile/story/DEAL_BREAKER')
      .send({ answer: 'Dishonesty.' });

    expect(res.status).toBe(500);
  });
});

// ── GET /api/v1/profile/me ────────────────────────────────────────────────────

const FULL_PROFILE_RESULT = {
  ...PROFILE_RESULT,
  realLifeAnswers: [
    { questionKey: 'DIET', value: 'Vegetarian', updatedAt: new Date('2026-05-27T10:00:00.000Z').toISOString() },
  ],
  storyPrompts: [
    { promptKey: 'DEAL_BREAKER', answer: 'Dishonesty.', updatedAt: new Date('2026-05-27T10:00:00.000Z').toISOString() },
  ],
  photos: [],
};

describe('GET /api/v1/profile/me', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAuthBehavior = 'pass';
    mockGetOwnProfile.mockResolvedValue(FULL_PROFILE_RESULT);
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it('returns 200 with the full ProfileDto for the authenticated user', async () => {
    const res = await request(app).get('/api/v1/profile/me');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('profile-uuid-1');
    expect(res.body.data.userId).toBe('user-uuid-1');
    expect(res.body.data.realLifeAnswers).toHaveLength(1);
    expect(res.body.data.storyPrompts).toHaveLength(1);
    expect(res.body.data.photos).toEqual([]);
  });

  it('passes userId from req.user to the service', async () => {
    await request(app).get('/api/v1/profile/me');

    expect(mockGetOwnProfile).toHaveBeenCalledWith('user-uuid-1');
  });

  it('propagates X-Request-ID through the response', async () => {
    const res = await request(app)
      .get('/api/v1/profile/me')
      .set('X-Request-ID', 'me-test-1111');

    expect(res.headers['x-request-id']).toBe('me-test-1111');
    expect(res.body.requestId).toBe('me-test-1111');
  });

  // ── Auth error ────────────────────────────────────────────────────────────

  it('returns 401 when requireAuth rejects the request', async () => {
    requireAuthBehavior = 'fail401';

    const res = await request(app).get('/api/v1/profile/me');

    expect(res.status).toBe(401);
    expect(mockGetOwnProfile).not.toHaveBeenCalled();
  });

  // ── Domain errors ─────────────────────────────────────────────────────────

  it('returns 404 NOT_FOUND when the user has no profile', async () => {
    const { ProfileNotFoundError } = getProfileErrors();
    mockGetOwnProfile.mockRejectedValueOnce(new ProfileNotFoundError());

    const res = await request(app).get('/api/v1/profile/me');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  // ── Unexpected error ──────────────────────────────────────────────────────

  it('returns 500 when getOwnProfile throws an unexpected error', async () => {
    mockGetOwnProfile.mockRejectedValueOnce(new Error('DB down'));

    const res = await request(app).get('/api/v1/profile/me');

    expect(res.status).toBe(500);
  });
});

// ── GET /api/v1/profiles/:id ──────────────────────────────────────────────────

// Use a proper UUID-format string — validateParams uses z.string().uuid()
const VALID_PROFILE_UUID = 'c7e3a1b2-d4f5-4e68-8c30-7a1c3f0e9b2d';

const OTHER_PROFILE_RESULT = {
  ...PROFILE_RESULT,
  id:     VALID_PROFILE_UUID,
  userId: 'b2f4e6a8-c1d3-4e57-9f20-6b8d0c2a4e1f',
  name:   'Arjun Nair',
};

describe('GET /api/v1/profiles/:id', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAuthBehavior = 'pass';
    mockGetProfileById.mockResolvedValue(OTHER_PROFILE_RESULT);
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it('returns 200 with ProfileDto for the given profile ID', async () => {
    const res = await request(app).get(`/api/v1/profiles/${VALID_PROFILE_UUID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(VALID_PROFILE_UUID);
    expect(res.body.data.name).toBe('Arjun Nair');
  });

  it('passes the validated profile ID to the service', async () => {
    await request(app).get(`/api/v1/profiles/${VALID_PROFILE_UUID}`);

    expect(mockGetProfileById).toHaveBeenCalledWith(VALID_PROFILE_UUID);
  });

  it('propagates X-Request-ID through the response', async () => {
    const res = await request(app)
      .get(`/api/v1/profiles/${VALID_PROFILE_UUID}`)
      .set('X-Request-ID', 'browse-test-2222');

    expect(res.headers['x-request-id']).toBe('browse-test-2222');
    expect(res.body.requestId).toBe('browse-test-2222');
  });

  // ── Auth error ────────────────────────────────────────────────────────────

  it('returns 401 when requireAuth rejects the request', async () => {
    requireAuthBehavior = 'fail401';

    const res = await request(app).get(`/api/v1/profiles/${VALID_PROFILE_UUID}`);

    expect(res.status).toBe(401);
    expect(mockGetProfileById).not.toHaveBeenCalled();
  });

  // ── Param validation ──────────────────────────────────────────────────────

  it('returns 400 VALIDATION_ERROR when the ID is not a valid UUID', async () => {
    const res = await request(app).get('/api/v1/profiles/not-a-valid-uuid');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockGetProfileById).not.toHaveBeenCalled();
  });

  // ── Domain errors ─────────────────────────────────────────────────────────

  it('returns 404 NOT_FOUND when no profile exists for the given ID', async () => {
    const { ProfileNotFoundError } = getProfileErrors();
    mockGetProfileById.mockRejectedValueOnce(new ProfileNotFoundError());

    const res = await request(app).get(`/api/v1/profiles/${VALID_PROFILE_UUID}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  // ── Unexpected error ──────────────────────────────────────────────────────

  it('returns 500 when getProfileById throws an unexpected error', async () => {
    mockGetProfileById.mockRejectedValueOnce(new Error('DB down'));

    const res = await request(app).get(`/api/v1/profiles/${VALID_PROFILE_UUID}`);

    expect(res.status).toBe(500);
  });
});

// ── POST /api/v1/profile/media ────────────────────────────────────────────────

const MEDIA_RESULT = {
  id:         'media-uuid-1',
  type:       'PHOTO',
  url:        'https://mock-cdn.example.com/photos/user-uuid-1/some-uuid.jpg',
  order:      1,
  isVerified: false,
  createdAt:  new Date('2026-05-27T10:00:00.000Z').toISOString(),
};

// A 1×1 pixel JPEG — valid binary for multer
const TINY_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k=',
  'base64',
);

describe('POST /api/v1/profile/media', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireAuthBehavior = 'pass';
    mockUploadProfilePhoto.mockResolvedValue(MEDIA_RESULT);
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it('returns 201 with MediaDto on a valid JPEG upload', async () => {
    const res = await request(app)
      .post('/api/v1/profile/media')
      .set('Content-Type', 'multipart/form-data')
      .attach('photo', TINY_JPEG, { filename: 'photo.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('media-uuid-1');
    expect(res.body.data.type).toBe('PHOTO');
    expect(res.body.data.url).toContain('mock-cdn');
  });

  it('passes userId, buffer, mimeType, and filename to the service', async () => {
    await request(app)
      .post('/api/v1/profile/media')
      .attach('photo', TINY_JPEG, { filename: 'portrait.jpg', contentType: 'image/jpeg' });

    expect(mockUploadProfilePhoto).toHaveBeenCalledWith(
      expect.objectContaining({
        userId:   'user-uuid-1',
        mimeType: 'image/jpeg',
        filename: 'portrait.jpg',
      }),
    );
    // buffer is a Buffer instance
    const arg = mockUploadProfilePhoto.mock.calls[0][0];
    expect(Buffer.isBuffer(arg.buffer)).toBe(true);
  });

  it('propagates X-Request-ID through the response', async () => {
    const res = await request(app)
      .post('/api/v1/profile/media')
      .set('X-Request-ID', 'media-test-3333')
      .attach('photo', TINY_JPEG, { filename: 'photo.jpg', contentType: 'image/jpeg' });

    expect(res.headers['x-request-id']).toBe('media-test-3333');
    expect(res.body.requestId).toBe('media-test-3333');
  });

  // ── Auth error ────────────────────────────────────────────────────────────

  it('returns 401 when requireAuth rejects the request', async () => {
    requireAuthBehavior = 'fail401';

    const res = await request(app)
      .post('/api/v1/profile/media')
      .attach('photo', TINY_JPEG, { filename: 'photo.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(401);
    expect(mockUploadProfilePhoto).not.toHaveBeenCalled();
  });

  // ── Multer validation — no file ───────────────────────────────────────────

  it('returns 400 when no file is attached', async () => {
    // Send a valid multipart request with no 'photo' field attached.
    // multer finds no file → req.file is undefined → middleware returns 400.
    const res = await request(app)
      .post('/api/v1/profile/media')
      .attach('wrong_field', TINY_JPEG, { filename: 'photo.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockUploadProfilePhoto).not.toHaveBeenCalled();
  });

  // ── Multer validation — wrong MIME type ───────────────────────────────────

  it('returns 400 VALIDATION_ERROR when file MIME type is not allowed (image/gif)', async () => {
    const res = await request(app)
      .post('/api/v1/profile/media')
      .attach('photo', Buffer.from('GIF89a'), { filename: 'anim.gif', contentType: 'image/gif' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(mockUploadProfilePhoto).not.toHaveBeenCalled();
  });

  // ── Service domain errors ─────────────────────────────────────────────────

  it('returns 404 NOT_FOUND when ProfileNotFoundError is thrown', async () => {
    const { ProfileNotFoundError } = getProfileErrors();
    mockUploadProfilePhoto.mockRejectedValueOnce(new ProfileNotFoundError());

    const res = await request(app)
      .post('/api/v1/profile/media')
      .attach('photo', TINY_JPEG, { filename: 'photo.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 409 CONFLICT when PhotoLimitExceededError is thrown', async () => {
    const { PhotoLimitExceededError } = getProfileErrors();
    mockUploadProfilePhoto.mockRejectedValueOnce(new PhotoLimitExceededError());

    const res = await request(app)
      .post('/api/v1/profile/media')
      .attach('photo', TINY_JPEG, { filename: 'photo.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('returns 400 VALIDATION_ERROR when InvalidMimeTypeError is thrown by the service', async () => {
    const { InvalidMimeTypeError } = getProfileErrors();
    mockUploadProfilePhoto.mockRejectedValueOnce(new InvalidMimeTypeError());

    const res = await request(app)
      .post('/api/v1/profile/media')
      .attach('photo', TINY_JPEG, { filename: 'photo.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // ── Unexpected error ──────────────────────────────────────────────────────

  it('returns 500 when uploadProfilePhoto throws an unexpected error', async () => {
    mockUploadProfilePhoto.mockRejectedValueOnce(new Error('S3 timeout'));

    const res = await request(app)
      .post('/api/v1/profile/media')
      .attach('photo', TINY_JPEG, { filename: 'photo.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(500);
  });
});
