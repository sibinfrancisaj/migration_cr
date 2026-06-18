import request from 'supertest';
import { createApp } from '../../../app.js';

// ── Service mocks ──────────────────────────────────────────────────────────────

const mockListSavedProfiles    = jest.fn();
const mockSaveProfile          = jest.fn();
const mockUpdateSavedProfile   = jest.fn();
const mockUnsaveProfile        = jest.fn();
const mockCompareSavedProfiles = jest.fn();

jest.mock('@abroad-matrimony/saved-profiles', () => ({
  listSavedProfiles:         (...a: unknown[]) => mockListSavedProfiles(...a),
  saveProfile:               (...a: unknown[]) => mockSaveProfile(...a),
  updateSavedProfile:        (...a: unknown[]) => mockUpdateSavedProfile(...a),
  unsaveProfile:             (...a: unknown[]) => mockUnsaveProfile(...a),
  compareSavedProfiles:      (...a: unknown[]) => mockCompareSavedProfiles(...a),
  SavedProfileNotFoundError: class extends Error { constructor() { super('NOT_FOUND');     this.name = 'SavedProfileNotFoundError'; } },
  AlreadySavedError:         class extends Error { constructor() { super('ALREADY_SAVED'); this.name = 'AlreadySavedError'; } },
  SaveSelfError:             class extends Error { constructor() { super('SAVE_SELF');     this.name = 'SaveSelfError'; } },
  ProfileNotSavedError:      class extends Error { constructor() { super('PROFILE_NOT_SAVED'); this.name = 'ProfileNotSavedError'; } },
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
const savedMock = jest.requireMock('@abroad-matrimony/saved-profiles') as any;
const SavedProfileNotFoundError = savedMock.SavedProfileNotFoundError as typeof Error;
const AlreadySavedError         = savedMock.AlreadySavedError         as typeof Error;
const SaveSelfError             = savedMock.SaveSelfError             as typeof Error;
const ProfileNotSavedError      = savedMock.ProfileNotSavedError      as typeof Error;

const app = createApp();

const USER_ID       = 'user-uuid-1';
const SAVED_USER_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const SAVED_DTO     = { userId: USER_ID, savedUserId: SAVED_USER_ID, label: 'INTERESTED', notes: null };

// ── GET /api/v1/saved ─────────────────────────────────────────────────────────

describe('GET /api/v1/saved', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with saved profiles list', async () => {
    mockListSavedProfiles.mockResolvedValue([SAVED_DTO]);

    const res = await request(app).get('/api/v1/saved');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
    expect(mockListSavedProfiles).toHaveBeenCalledWith(USER_ID, undefined);
  });

  it('returns 200 filtered by label', async () => {
    mockListSavedProfiles.mockResolvedValue([SAVED_DTO]);

    const res = await request(app).get('/api/v1/saved?label=INTERESTED');

    expect(res.status).toBe(200);
    expect(mockListSavedProfiles).toHaveBeenCalledWith(USER_ID, 'INTERESTED');
  });

  it('returns 400 when label is not a valid SavedProfileLabel', async () => {
    const res = await request(app).get('/api/v1/saved?label=INVALID');
    expect(res.status).toBe(400);
  });
});

// ── POST /api/v1/saved ────────────────────────────────────────────────────────

describe('POST /api/v1/saved', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 201 with saved DTO on success', async () => {
    mockSaveProfile.mockResolvedValue(SAVED_DTO);

    const res = await request(app)
      .post('/api/v1/saved')
      .send({ savedUserId: SAVED_USER_ID, label: 'INTERESTED' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.savedUserId).toBe(SAVED_USER_ID);
  });

  it('returns 201 with default label when not provided', async () => {
    mockSaveProfile.mockResolvedValue(SAVED_DTO);

    await request(app).post('/api/v1/saved').send({ savedUserId: SAVED_USER_ID });
    expect(mockSaveProfile).toHaveBeenCalledWith(USER_ID, SAVED_USER_ID, 'INTERESTED', undefined);
  });

  it('returns 409 when profile is already saved', async () => {
    mockSaveProfile.mockRejectedValueOnce(new AlreadySavedError());

    const res = await request(app).post('/api/v1/saved').send({ savedUserId: SAVED_USER_ID });
    expect(res.status).toBe(409);
  });

  it('returns 400 when trying to save your own profile', async () => {
    mockSaveProfile.mockRejectedValueOnce(new SaveSelfError());

    const res = await request(app).post('/api/v1/saved').send({ savedUserId: SAVED_USER_ID });
    expect(res.status).toBe(400);
  });

  it('returns 400 when savedUserId is missing', async () => {
    const res = await request(app).post('/api/v1/saved').send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when savedUserId is not a UUID', async () => {
    const res = await request(app).post('/api/v1/saved').send({ savedUserId: 'not-a-uuid' });
    expect(res.status).toBe(400);
  });
});

// ── PATCH /api/v1/saved/:savedUserId ─────────────────────────────────────────

describe('PATCH /api/v1/saved/:savedUserId', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with updated saved DTO', async () => {
    const updated = { ...SAVED_DTO, label: 'MAYBE' };
    mockUpdateSavedProfile.mockResolvedValue(updated);

    const res = await request(app)
      .patch(`/api/v1/saved/${SAVED_USER_ID}`)
      .send({ label: 'MAYBE' });

    expect(res.status).toBe(200);
    expect(res.body.data.label).toBe('MAYBE');
  });

  it('returns 400 when neither label nor notes is provided', async () => {
    const res = await request(app)
      .patch(`/api/v1/saved/${SAVED_USER_ID}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 404 when saved profile does not exist', async () => {
    mockUpdateSavedProfile.mockRejectedValueOnce(new SavedProfileNotFoundError());

    const res = await request(app)
      .patch(`/api/v1/saved/${SAVED_USER_ID}`)
      .send({ notes: 'Updated note' });
    expect(res.status).toBe(404);
  });

  it('returns 400 when savedUserId is not a UUID', async () => {
    const res = await request(app)
      .patch('/api/v1/saved/not-a-uuid')
      .send({ label: 'MAYBE' });
    expect(res.status).toBe(400);
  });
});

// ── DELETE /api/v1/saved/:savedUserId ────────────────────────────────────────

describe('DELETE /api/v1/saved/:savedUserId', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 on successful unsave', async () => {
    mockUnsaveProfile.mockResolvedValue(undefined);

    const res = await request(app).delete(`/api/v1/saved/${SAVED_USER_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeNull();
    expect(mockUnsaveProfile).toHaveBeenCalledWith(USER_ID, SAVED_USER_ID);
  });

  it('returns 404 when saved profile does not exist', async () => {
    mockUnsaveProfile.mockRejectedValueOnce(new SavedProfileNotFoundError());

    const res = await request(app).delete(`/api/v1/saved/${SAVED_USER_ID}`);
    expect(res.status).toBe(404);
  });

  it('returns 400 when savedUserId is not a UUID', async () => {
    const res = await request(app).delete('/api/v1/saved/not-a-uuid');
    expect(res.status).toBe(400);
  });
});

// ── POST /api/v1/saved/:savedUserId/note ──────────────────────────────────────

const ANOTHER_USER_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd';

describe('POST /api/v1/saved/:savedUserId/note', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with updated DTO after note saved', async () => {
    const updated = { ...SAVED_DTO, notes: 'Great match potential' };
    mockUpdateSavedProfile.mockResolvedValue(updated);

    const res = await request(app)
      .post(`/api/v1/saved/${SAVED_USER_ID}/note`)
      .send({ notes: 'Great match potential' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.notes).toBe('Great match potential');
    expect(mockUpdateSavedProfile).toHaveBeenCalledWith(USER_ID, SAVED_USER_ID, { notes: 'Great match potential' });
  });

  it('returns 400 when notes field is missing', async () => {
    const res = await request(app)
      .post(`/api/v1/saved/${SAVED_USER_ID}/note`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when notes exceeds 500 characters', async () => {
    const res = await request(app)
      .post(`/api/v1/saved/${SAVED_USER_ID}/note`)
      .send({ notes: 'x'.repeat(501) });
    expect(res.status).toBe(400);
  });

  it('returns 404 when saved profile does not exist', async () => {
    mockUpdateSavedProfile.mockRejectedValueOnce(new SavedProfileNotFoundError());

    const res = await request(app)
      .post(`/api/v1/saved/${SAVED_USER_ID}/note`)
      .send({ notes: 'Some note' });
    expect(res.status).toBe(404);
  });

  it('returns 400 when savedUserId is not a UUID', async () => {
    const res = await request(app)
      .post('/api/v1/saved/not-a-uuid/note')
      .send({ notes: 'Some note' });
    expect(res.status).toBe(400);
  });
});

// ── GET /api/v1/saved/compare?ids=... ────────────────────────────────────────

const COMPARE_DTO = [
  { savedUserId: SAVED_USER_ID, label: 'INTERESTED', notes: null, profile: { name: 'Alice' }, realLifeAnswers: [] },
  { savedUserId: ANOTHER_USER_ID, label: 'MAYBE', notes: 'Possible', profile: { name: 'Bob' }, realLifeAnswers: [] },
];

describe('GET /api/v1/saved/compare', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with comparison data for 2 profiles', async () => {
    mockCompareSavedProfiles.mockResolvedValue(COMPARE_DTO);

    const res = await request(app)
      .get(`/api/v1/saved/compare?ids=${SAVED_USER_ID},${ANOTHER_USER_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(mockCompareSavedProfiles).toHaveBeenCalledWith(USER_ID, [SAVED_USER_ID, ANOTHER_USER_ID]);
  });

  it('returns 400 when only 1 id is provided', async () => {
    const res = await request(app).get(`/api/v1/saved/compare?ids=${SAVED_USER_ID}`);
    expect(res.status).toBe(400);
  });

  it('returns 400 when more than 3 ids are provided', async () => {
    const ids = [SAVED_USER_ID, ANOTHER_USER_ID, 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'ffffffff-ffff-ffff-ffff-ffffffffffff'];
    const res = await request(app).get(`/api/v1/saved/compare?ids=${ids.join(',')}`);
    expect(res.status).toBe(400);
  });

  it('returns 400 when ids param is missing', async () => {
    const res = await request(app).get('/api/v1/saved/compare');
    expect(res.status).toBe(400);
  });

  it('returns 400 when an id is not a valid UUID', async () => {
    const res = await request(app).get(`/api/v1/saved/compare?ids=${SAVED_USER_ID},not-a-uuid`);
    expect(res.status).toBe(400);
  });

  it('returns 404 when a profile is not in the saved list', async () => {
    mockCompareSavedProfiles.mockRejectedValueOnce(new ProfileNotSavedError(ANOTHER_USER_ID));

    const res = await request(app)
      .get(`/api/v1/saved/compare?ids=${SAVED_USER_ID},${ANOTHER_USER_ID}`);
    expect(res.status).toBe(404);
  });
});
