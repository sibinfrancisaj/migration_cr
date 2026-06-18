import request from 'supertest';
import { createApp } from '../../../app.js';

// ── Service mocks ──────────────────────────────────────────────────────────────

const mockListHabits           = jest.fn();
const mockLogHabit             = jest.fn();
const mockDeleteHabitLog       = jest.fn();
const mockGetHabitStreak       = jest.fn();
const mockAddHabitReflection   = jest.fn();
const mockGetAllHabitsWithStreaks = jest.fn();
const mockGetHabitHistory      = jest.fn();
const mockGetWeeklyReflection  = jest.fn();
const mockUpdateSummaryVisibility = jest.fn();

jest.mock('@abroad-matrimony/habits', () => ({
  listHabits:                (...a: unknown[]) => mockListHabits(...a),
  logHabit:                  (...a: unknown[]) => mockLogHabit(...a),
  deleteHabitLog:            (...a: unknown[]) => mockDeleteHabitLog(...a),
  getHabitStreak:            (...a: unknown[]) => mockGetHabitStreak(...a),
  addHabitReflection:        (...a: unknown[]) => mockAddHabitReflection(...a),
  getAllHabitsWithStreaks:    (...a: unknown[]) => mockGetAllHabitsWithStreaks(...a),
  getHabitHistory:           (...a: unknown[]) => mockGetHabitHistory(...a),
  getWeeklyReflection:       (...a: unknown[]) => mockGetWeeklyReflection(...a),
  updateSummaryVisibility:   (...a: unknown[]) => mockUpdateSummaryVisibility(...a),
  HabitLogNotFoundError:  class extends Error { constructor() { super('NOT_FOUND'); this.name = 'HabitLogNotFoundError'; } },
  HabitAlreadyLoggedError: class extends Error { constructor() { super('ALREADY_LOGGED'); this.name = 'HabitAlreadyLoggedError'; } },
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
const habitsMock = jest.requireMock('@abroad-matrimony/habits') as any;
const HabitLogNotFoundError   = habitsMock.HabitLogNotFoundError  as typeof Error;
const HabitAlreadyLoggedError = habitsMock.HabitAlreadyLoggedError as typeof Error;

const app = createApp();

const USER_ID   = 'user-uuid-1';
const HABIT_KEY = 'HYDRATION';
const LOG_DATE  = '2025-01-15';

const HABIT_DTO = { habitKey: HABIT_KEY, logDate: LOG_DATE, notes: null };
const STREAK_DTO = { habitKey: HABIT_KEY, currentStreak: 3, longestStreak: 7 };

// ── GET /api/v1/habits ────────────────────────────────────────────────────────

describe('GET /api/v1/habits', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with all habits', async () => {
    mockListHabits.mockResolvedValue([HABIT_DTO]);

    const res = await request(app).get('/api/v1/habits');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
    expect(mockListHabits).toHaveBeenCalledWith(USER_ID);
  });

  it('returns 200 with empty array when no habits logged', async () => {
    mockListHabits.mockResolvedValue([]);

    const res = await request(app).get('/api/v1/habits');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('returns 500 when service throws', async () => {
    mockListHabits.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app).get('/api/v1/habits');
    expect(res.status).toBe(500);
  });
});

// ── POST /api/v1/habits/:habitKey/log ─────────────────────────────────────────

describe('POST /api/v1/habits/:habitKey/log', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 201 with log DTO on success', async () => {
    mockLogHabit.mockResolvedValue(HABIT_DTO);

    const res = await request(app)
      .post(`/api/v1/habits/${HABIT_KEY}/log`)
      .send({ logDate: LOG_DATE });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.habitKey).toBe(HABIT_KEY);
  });

  it('returns 201 with no body (defaults to today)', async () => {
    mockLogHabit.mockResolvedValue(HABIT_DTO);

    const res = await request(app)
      .post(`/api/v1/habits/${HABIT_KEY}/log`)
      .send({});

    expect(res.status).toBe(201);
  });

  it('returns 400 when habitKey is invalid enum value', async () => {
    const res = await request(app)
      .post('/api/v1/habits/INVALID_KEY/log')
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when logDate format is wrong', async () => {
    const res = await request(app)
      .post(`/api/v1/habits/${HABIT_KEY}/log`)
      .send({ logDate: '15-01-2025' });
    expect(res.status).toBe(400);
  });

  it('returns 409 when habit already logged for that date', async () => {
    mockLogHabit.mockRejectedValueOnce(new HabitAlreadyLoggedError());

    const res = await request(app)
      .post(`/api/v1/habits/${HABIT_KEY}/log`)
      .send({ logDate: LOG_DATE });
    expect(res.status).toBe(409);
  });

  it('returns 500 when service throws unexpected error', async () => {
    mockLogHabit.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app)
      .post(`/api/v1/habits/${HABIT_KEY}/log`)
      .send({});
    expect(res.status).toBe(500);
  });
});

// ── DELETE /api/v1/habits/:habitKey/log/:date ─────────────────────────────────

describe('DELETE /api/v1/habits/:habitKey/log/:date', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 on successful deletion', async () => {
    mockDeleteHabitLog.mockResolvedValue(undefined);

    const res = await request(app)
      .delete(`/api/v1/habits/${HABIT_KEY}/log/${LOG_DATE}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeNull();
  });

  it('returns 404 when log entry does not exist', async () => {
    mockDeleteHabitLog.mockRejectedValueOnce(new HabitLogNotFoundError());

    const res = await request(app)
      .delete(`/api/v1/habits/${HABIT_KEY}/log/${LOG_DATE}`);
    expect(res.status).toBe(404);
  });

  it('returns 400 when habitKey is invalid', async () => {
    const res = await request(app)
      .delete(`/api/v1/habits/INVALID/log/${LOG_DATE}`);
    expect(res.status).toBe(400);
  });

  it('returns 400 when date format is invalid', async () => {
    const res = await request(app)
      .delete(`/api/v1/habits/${HABIT_KEY}/log/not-a-date`);
    expect(res.status).toBe(400);
  });
});

// ── GET /api/v1/habits/:habitKey/streak ──────────────────────────────────────

describe('GET /api/v1/habits/:habitKey/streak', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with streak data', async () => {
    mockGetHabitStreak.mockResolvedValue(STREAK_DTO);

    const res = await request(app)
      .get(`/api/v1/habits/${HABIT_KEY}/streak`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.currentStreak).toBe(3);
    expect(mockGetHabitStreak).toHaveBeenCalledWith(USER_ID, HABIT_KEY);
  });

  it('returns 400 when habitKey is invalid', async () => {
    const res = await request(app).get('/api/v1/habits/INVALID/streak');
    expect(res.status).toBe(400);
  });

  it('returns 500 when service throws', async () => {
    mockGetHabitStreak.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app).get(`/api/v1/habits/${HABIT_KEY}/streak`);
    expect(res.status).toBe(500);
  });
});

// ── POST /api/v1/habits/reflection ────────────────────────────────────────────

describe('POST /api/v1/habits/reflection', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with updated log on success', async () => {
    const reflectionDto = { ...HABIT_DTO, reflection: 'Felt great!' };
    mockAddHabitReflection.mockResolvedValue(reflectionDto);

    const res = await request(app)
      .post('/api/v1/habits/reflection')
      .send({ habitKey: HABIT_KEY, reflection: 'Felt great!' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.reflection).toBe('Felt great!');
    expect(mockAddHabitReflection).toHaveBeenCalledWith(USER_ID, HABIT_KEY, 'Felt great!');
  });

  it('returns 400 when habitKey is missing', async () => {
    const res = await request(app)
      .post('/api/v1/habits/reflection')
      .send({ reflection: 'Felt great!' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when reflection is empty', async () => {
    const res = await request(app)
      .post('/api/v1/habits/reflection')
      .send({ habitKey: HABIT_KEY, reflection: '' });
    expect(res.status).toBe(400);
  });

  it('returns 404 when no log found for today', async () => {
    mockAddHabitReflection.mockRejectedValueOnce(new HabitLogNotFoundError());

    const res = await request(app)
      .post('/api/v1/habits/reflection')
      .send({ habitKey: HABIT_KEY, reflection: 'Felt great!' });
    expect(res.status).toBe(404);
  });
});

// ── GET /api/v1/habits/streaks ─────────────────────────────────────────────────

const STREAK_WITH_DOTS_DTO = {
  habitKey: HABIT_KEY,
  label: 'Drink water',
  currentStreak: 3,
  longestStreak: 7,
  totalCompleted: 10,
  lastLoggedDate: LOG_DATE,
  thisWeekDots: [true, true, false, true, false, false, false],
};

describe('GET /api/v1/habits/streaks', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with all habits and weekly dots', async () => {
    mockGetAllHabitsWithStreaks.mockResolvedValue([STREAK_WITH_DOTS_DTO]);

    const res = await request(app).get('/api/v1/habits/streaks');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].thisWeekDots).toHaveLength(7);
    expect(res.body.meta.total).toBe(1);
    expect(mockGetAllHabitsWithStreaks).toHaveBeenCalledWith(USER_ID);
  });

  it('returns 200 with empty array when no logs yet', async () => {
    mockGetAllHabitsWithStreaks.mockResolvedValue([]);

    const res = await request(app).get('/api/v1/habits/streaks');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('returns 500 when service throws', async () => {
    mockGetAllHabitsWithStreaks.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app).get('/api/v1/habits/streaks');
    expect(res.status).toBe(500);
  });
});

// ── GET /api/v1/habits/:habitKey/history ──────────────────────────────────────

const HISTORY_WEEK_DTO = {
  weekStartDate: '2025-01-06',
  completedDays: 4,
  dailyDots: [true, true, false, true, false, false, true],
};

describe('GET /api/v1/habits/:habitKey/history', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with weekly history', async () => {
    mockGetHabitHistory.mockResolvedValue([HISTORY_WEEK_DTO]);

    const res = await request(app).get(`/api/v1/habits/${HABIT_KEY}/history`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data[0].weekStartDate).toBe('2025-01-06');
    expect(mockGetHabitHistory).toHaveBeenCalledWith(USER_ID, HABIT_KEY, 8);
  });

  it('passes custom weeks param', async () => {
    mockGetHabitHistory.mockResolvedValue([]);

    const res = await request(app).get(`/api/v1/habits/${HABIT_KEY}/history?weeks=4`);

    expect(res.status).toBe(200);
    expect(mockGetHabitHistory).toHaveBeenCalledWith(USER_ID, HABIT_KEY, 4);
  });

  it('returns 400 for invalid habitKey', async () => {
    const res = await request(app).get('/api/v1/habits/INVALID/history');
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid weeks (> 52)', async () => {
    const res = await request(app).get(`/api/v1/habits/${HABIT_KEY}/history?weeks=100`);
    expect(res.status).toBe(400);
  });

  it('returns 500 when service throws', async () => {
    mockGetHabitHistory.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app).get(`/api/v1/habits/${HABIT_KEY}/history`);
    expect(res.status).toBe(500);
  });
});

// ── GET /api/v1/habits/weekly-reflection ──────────────────────────────────────

const REFLECTION_DTO = {
  insight: 'You are most consistent on Mondays.',
  whyItMatters: 'Partners with consistent habits show higher long-term compatibility.',
  weekStartDate: '2025-01-06',
};

describe('GET /api/v1/habits/weekly-reflection', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with reflection DTO', async () => {
    mockGetWeeklyReflection.mockResolvedValue(REFLECTION_DTO);

    const res = await request(app).get('/api/v1/habits/weekly-reflection');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.insight).toBeTruthy();
    expect(res.body.data.weekStartDate).toBeTruthy();
    expect(mockGetWeeklyReflection).toHaveBeenCalledWith(USER_ID);
  });

  it('returns 500 when service throws', async () => {
    mockGetWeeklyReflection.mockRejectedValueOnce(new Error('cache error'));

    const res = await request(app).get('/api/v1/habits/weekly-reflection');
    expect(res.status).toBe(500);
  });
});

// ── PUT /api/v1/habits/summary-visibility ─────────────────────────────────────

describe('PUT /api/v1/habits/summary-visibility', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 when visibility set to true', async () => {
    mockUpdateSummaryVisibility.mockResolvedValue(undefined);

    const res = await request(app)
      .put('/api/v1/habits/summary-visibility')
      .send({ visible: true });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.visible).toBe(true);
    expect(mockUpdateSummaryVisibility).toHaveBeenCalledWith(USER_ID, true);
  });

  it('returns 200 when visibility set to false', async () => {
    mockUpdateSummaryVisibility.mockResolvedValue(undefined);

    const res = await request(app)
      .put('/api/v1/habits/summary-visibility')
      .send({ visible: false });

    expect(res.status).toBe(200);
    expect(res.body.data.visible).toBe(false);
  });

  it('returns 400 when visible field is missing', async () => {
    const res = await request(app)
      .put('/api/v1/habits/summary-visibility')
      .send({});
    expect(res.status).toBe(400);
  });

  it('returns 400 when visible is not a boolean', async () => {
    const res = await request(app)
      .put('/api/v1/habits/summary-visibility')
      .send({ visible: 'yes' });
    expect(res.status).toBe(400);
  });

  it('returns 500 when service throws', async () => {
    mockUpdateSummaryVisibility.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app)
      .put('/api/v1/habits/summary-visibility')
      .send({ visible: true });
    expect(res.status).toBe(500);
  });
});
