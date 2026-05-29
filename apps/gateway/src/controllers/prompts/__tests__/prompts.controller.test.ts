import request from 'supertest';
import { createApp } from '../../../app.js';

// ── Service mocks ──────────────────────────────────────────────────────────────

const mockGetCurrentPrompt   = jest.fn();
const mockRespondToPrompt    = jest.fn();
const mockGetPromptResponses = jest.fn();
const mockResonateResponse   = jest.fn();
const mockUnresonateResponse = jest.fn();

jest.mock('@abroad-matrimony/prompts', () => ({
  getCurrentPrompt:        (...a: unknown[]) => mockGetCurrentPrompt(...a),
  respondToPrompt:         (...a: unknown[]) => mockRespondToPrompt(...a),
  getPromptResponses:      (...a: unknown[]) => mockGetPromptResponses(...a),
  resonateResponse:        (...a: unknown[]) => mockResonateResponse(...a),
  unresonateResponse:      (...a: unknown[]) => mockUnresonateResponse(...a),
  PromptNotFoundError:        class extends Error { constructor() { super('NOT_FOUND');           this.name = 'PromptNotFoundError'; } },
  PromptResponseNotFoundError: class extends Error { constructor() { super('RESPONSE_NOT_FOUND'); this.name = 'PromptResponseNotFoundError'; } },
  AlreadyRespondedError:      class extends Error { constructor() { super('ALREADY_RESPONDED');   this.name = 'AlreadyRespondedError'; } },
  AlreadyResonatedError:      class extends Error { constructor() { super('ALREADY_RESONATED');   this.name = 'AlreadyResonatedError'; } },
  ResonateNotFoundError:      class extends Error { constructor() { super('RESONATE_NOT_FOUND');  this.name = 'ResonateNotFoundError'; } },
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
const promptsMock = jest.requireMock('@abroad-matrimony/prompts') as any;
const PromptNotFoundError         = promptsMock.PromptNotFoundError         as typeof Error;
const PromptResponseNotFoundError = promptsMock.PromptResponseNotFoundError as typeof Error;
const AlreadyRespondedError       = promptsMock.AlreadyRespondedError       as typeof Error;
const AlreadyResonatedError       = promptsMock.AlreadyResonatedError       as typeof Error;
const ResonateNotFoundError       = promptsMock.ResonateNotFoundError       as typeof Error;

const app = createApp();

const USER_ID     = 'user-uuid-1';
const PROMPT_ID   = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const RESPONSE_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const PROMPT_DTO  = { id: PROMPT_ID, weekKey: '2025-W22', text: 'What does home mean to you?' };
const RESPONSE_DTO = { id: RESPONSE_ID, promptId: PROMPT_ID, userId: USER_ID, text: 'A safe place', type: 'TEXT' };

// ── GET /api/v1/prompts ───────────────────────────────────────────────────────

describe('GET /api/v1/prompts', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with the current prompt', async () => {
    mockGetCurrentPrompt.mockResolvedValue(PROMPT_DTO);

    const res = await request(app).get('/api/v1/prompts');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(PROMPT_ID);
    expect(mockGetCurrentPrompt).toHaveBeenCalledWith(USER_ID);
  });

  it('returns 404 when no active prompt exists', async () => {
    mockGetCurrentPrompt.mockRejectedValueOnce(new PromptNotFoundError());

    const res = await request(app).get('/api/v1/prompts');
    expect(res.status).toBe(404);
  });

  it('returns 500 when service throws unexpected error', async () => {
    mockGetCurrentPrompt.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app).get('/api/v1/prompts');
    expect(res.status).toBe(500);
  });
});

// ── POST /api/v1/prompts/:promptId/respond ────────────────────────────────────

describe('POST /api/v1/prompts/:promptId/respond', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 201 with response DTO on success', async () => {
    mockRespondToPrompt.mockResolvedValue(RESPONSE_DTO);

    const res = await request(app)
      .post(`/api/v1/prompts/${PROMPT_ID}/respond`)
      .send({ text: 'A safe place', type: 'TEXT' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(RESPONSE_ID);
    expect(mockRespondToPrompt).toHaveBeenCalledWith(USER_ID, PROMPT_ID, 'A safe place', 'TEXT', undefined);
  });

  it('returns 201 with default type TEXT when type is omitted', async () => {
    mockRespondToPrompt.mockResolvedValue(RESPONSE_DTO);

    await request(app)
      .post(`/api/v1/prompts/${PROMPT_ID}/respond`)
      .send({ text: 'Home is where family is' });

    expect(mockRespondToPrompt).toHaveBeenCalledWith(USER_ID, PROMPT_ID, 'Home is where family is', 'TEXT', undefined);
  });

  it('returns 201 with optional mediaUrl (AUDIO type)', async () => {
    const dtoWithMedia = { ...RESPONSE_DTO, type: 'AUDIO', mediaUrl: 'https://cdn.example.com/audio.m4a' };
    mockRespondToPrompt.mockResolvedValue(dtoWithMedia);

    const res = await request(app)
      .post(`/api/v1/prompts/${PROMPT_ID}/respond`)
      .send({ text: 'Voice note', type: 'AUDIO', mediaUrl: 'https://cdn.example.com/audio.m4a' });

    expect(res.status).toBe(201);
    expect(mockRespondToPrompt).toHaveBeenCalledWith(
      USER_ID, PROMPT_ID, 'Voice note', 'AUDIO', 'https://cdn.example.com/audio.m4a',
    );
  });

  it('returns 409 when user has already responded to this prompt', async () => {
    mockRespondToPrompt.mockRejectedValueOnce(new AlreadyRespondedError());

    const res = await request(app)
      .post(`/api/v1/prompts/${PROMPT_ID}/respond`)
      .send({ text: 'Duplicate answer' });
    expect(res.status).toBe(409);
  });

  it('returns 404 when prompt does not exist', async () => {
    mockRespondToPrompt.mockRejectedValueOnce(new PromptNotFoundError());

    const res = await request(app)
      .post(`/api/v1/prompts/${PROMPT_ID}/respond`)
      .send({ text: 'My answer' });
    expect(res.status).toBe(404);
  });

  it('returns 400 when text is missing', async () => {
    const res = await request(app)
      .post(`/api/v1/prompts/${PROMPT_ID}/respond`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when text is empty string', async () => {
    const res = await request(app)
      .post(`/api/v1/prompts/${PROMPT_ID}/respond`)
      .send({ text: '' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when text exceeds 2000 characters', async () => {
    const res = await request(app)
      .post(`/api/v1/prompts/${PROMPT_ID}/respond`)
      .send({ text: 'a'.repeat(2001) });
    expect(res.status).toBe(400);
  });

  it('returns 400 when type is not a valid PromptResponseType', async () => {
    const res = await request(app)
      .post(`/api/v1/prompts/${PROMPT_ID}/respond`)
      .send({ text: 'My answer', type: 'INVALID_TYPE' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when promptId is not a UUID', async () => {
    const res = await request(app)
      .post('/api/v1/prompts/not-a-uuid/respond')
      .send({ text: 'My answer' });
    expect(res.status).toBe(400);
  });

  it('returns 500 when service throws unexpected error', async () => {
    mockRespondToPrompt.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app)
      .post(`/api/v1/prompts/${PROMPT_ID}/respond`)
      .send({ text: 'My answer' });
    expect(res.status).toBe(500);
  });
});

// ── GET /api/v1/prompts/:promptId/responses ───────────────────────────────────

describe('GET /api/v1/prompts/:promptId/responses', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with paginated responses', async () => {
    mockGetPromptResponses.mockResolvedValue({ responses: [RESPONSE_DTO], total: 1 });

    const res = await request(app).get(`/api/v1/prompts/${PROMPT_ID}/responses?page=1&limit=10`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
    expect(mockGetPromptResponses).toHaveBeenCalledWith(USER_ID, PROMPT_ID, 1, 10);
  });

  it('returns 200 with default pagination when no query params', async () => {
    mockGetPromptResponses.mockResolvedValue({ responses: [], total: 0 });

    const res = await request(app).get(`/api/v1/prompts/${PROMPT_ID}/responses`);

    expect(res.status).toBe(200);
    expect(mockGetPromptResponses).toHaveBeenCalledWith(USER_ID, PROMPT_ID, 1, 20);
  });

  it('returns 400 when limit exceeds maximum of 50', async () => {
    const res = await request(app).get(`/api/v1/prompts/${PROMPT_ID}/responses?limit=51`);
    expect(res.status).toBe(400);
  });

  it('returns 404 when prompt does not exist', async () => {
    mockGetPromptResponses.mockRejectedValueOnce(new PromptNotFoundError());

    const res = await request(app).get(`/api/v1/prompts/${PROMPT_ID}/responses`);
    expect(res.status).toBe(404);
  });

  it('returns 400 when promptId is not a UUID', async () => {
    const res = await request(app).get('/api/v1/prompts/not-a-uuid/responses');
    expect(res.status).toBe(400);
  });

  it('returns 500 when service throws unexpected error', async () => {
    mockGetPromptResponses.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app).get(`/api/v1/prompts/${PROMPT_ID}/responses`);
    expect(res.status).toBe(500);
  });
});

// ── POST /api/v1/prompts/responses/:responseId/resonate ───────────────────────

describe('POST /api/v1/prompts/responses/:responseId/resonate', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with null data on successful resonate', async () => {
    mockResonateResponse.mockResolvedValue(undefined);

    const res = await request(app).post(`/api/v1/prompts/responses/${RESPONSE_ID}/resonate`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeNull();
    expect(mockResonateResponse).toHaveBeenCalledWith(USER_ID, RESPONSE_ID);
  });

  it('returns 409 when user has already resonated with this response', async () => {
    mockResonateResponse.mockRejectedValueOnce(new AlreadyResonatedError());

    const res = await request(app).post(`/api/v1/prompts/responses/${RESPONSE_ID}/resonate`);
    expect(res.status).toBe(409);
  });

  it('returns 404 when response does not exist', async () => {
    mockResonateResponse.mockRejectedValueOnce(new PromptResponseNotFoundError());

    const res = await request(app).post(`/api/v1/prompts/responses/${RESPONSE_ID}/resonate`);
    expect(res.status).toBe(404);
  });

  it('returns 400 when responseId is not a UUID', async () => {
    const res = await request(app).post('/api/v1/prompts/responses/not-a-uuid/resonate');
    expect(res.status).toBe(400);
  });

  it('returns 500 when service throws unexpected error', async () => {
    mockResonateResponse.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app).post(`/api/v1/prompts/responses/${RESPONSE_ID}/resonate`);
    expect(res.status).toBe(500);
  });
});

// ── DELETE /api/v1/prompts/responses/:responseId/resonate ─────────────────────

describe('DELETE /api/v1/prompts/responses/:responseId/resonate', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with null data on successful unresonate', async () => {
    mockUnresonateResponse.mockResolvedValue(undefined);

    const res = await request(app).delete(`/api/v1/prompts/responses/${RESPONSE_ID}/resonate`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeNull();
    expect(mockUnresonateResponse).toHaveBeenCalledWith(USER_ID, RESPONSE_ID);
  });

  it('returns 404 when resonate reaction does not exist', async () => {
    mockUnresonateResponse.mockRejectedValueOnce(new ResonateNotFoundError());

    const res = await request(app).delete(`/api/v1/prompts/responses/${RESPONSE_ID}/resonate`);
    expect(res.status).toBe(404);
  });

  it('returns 404 when response does not exist', async () => {
    mockUnresonateResponse.mockRejectedValueOnce(new PromptResponseNotFoundError());

    const res = await request(app).delete(`/api/v1/prompts/responses/${RESPONSE_ID}/resonate`);
    expect(res.status).toBe(404);
  });

  it('returns 400 when responseId is not a UUID', async () => {
    const res = await request(app).delete('/api/v1/prompts/responses/not-a-uuid/resonate');
    expect(res.status).toBe(400);
  });

  it('returns 500 when service throws unexpected error', async () => {
    mockUnresonateResponse.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app).delete(`/api/v1/prompts/responses/${RESPONSE_ID}/resonate`);
    expect(res.status).toBe(500);
  });
});
