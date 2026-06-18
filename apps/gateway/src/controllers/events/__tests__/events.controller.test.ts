import request from 'supertest';
import { createApp } from '../../../app.js';

// ── Service mocks ──────────────────────────────────────────────────────────────

const mockListEvents          = jest.fn();
const mockGetEvent            = jest.fn();
const mockRsvpToEvent         = jest.fn();
const mockCancelRsvp          = jest.fn();
const mockGetEventAttendees   = jest.fn();
const mockGetEventCalendar    = jest.fn();
const mockGetCoAttendancePairs = jest.fn();

jest.mock('@abroad-matrimony/gatherings', () => ({
  listEvents:             (...a: unknown[]) => mockListEvents(...a),
  getEvent:               (...a: unknown[]) => mockGetEvent(...a),
  rsvpToEvent:            (...a: unknown[]) => mockRsvpToEvent(...a),
  cancelRsvp:             (...a: unknown[]) => mockCancelRsvp(...a),
  getEventAttendees:      (...a: unknown[]) => mockGetEventAttendees(...a),
  getEventCalendar:       (...a: unknown[]) => mockGetEventCalendar(...a),
  getCoAttendancePairs:   (...a: unknown[]) => mockGetCoAttendancePairs(...a),
  EventNotFoundError:     class extends Error { constructor() { super('NOT_FOUND');     this.name = 'EventNotFoundError'; } },
  AlreadyRsvpdError:      class extends Error { constructor() { super('ALREADY_RSVPD'); this.name = 'AlreadyRsvpdError'; } },
  NotRsvpdError:          class extends Error { constructor() { super('NOT_RSVPD');     this.name = 'NotRsvpdError'; } },
  EventFullError:         class extends Error { constructor() { super('EVENT_FULL');    this.name = 'EventFullError'; } },
  EventNotUpcomingError:  class extends Error { constructor() { super('NOT_UPCOMING'); this.name = 'EventNotUpcomingError'; } },
}));

const mockEnqueueScoreRecompute = jest.fn();
jest.mock('@abroad-matrimony/matching', () => ({
  enqueueScoreRecompute: (...a: unknown[]) => mockEnqueueScoreRecompute(...a),
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
const eventsMock = jest.requireMock('@abroad-matrimony/gatherings') as any;
const EventNotFoundError    = eventsMock.EventNotFoundError    as typeof Error;
const AlreadyRsvpdError     = eventsMock.AlreadyRsvpdError     as typeof Error;
const NotRsvpdError         = eventsMock.NotRsvpdError         as typeof Error;
const EventFullError        = eventsMock.EventFullError        as typeof Error;
const EventNotUpcomingError = eventsMock.EventNotUpcomingError as typeof Error;

const app = createApp();

const USER_ID  = 'user-uuid-1';
const EVENT_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
const EVENT_DTO = { id: EVENT_ID, title: 'Community Meetup', tag: 'SOCIAL', status: 'UPCOMING' };
const ATTENDEE_DTO = { userId: USER_ID, name: 'Test User' };

// ── GET /api/v1/events ────────────────────────────────────────────────────────

describe('GET /api/v1/events', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with list of events', async () => {
    mockListEvents.mockResolvedValue([EVENT_DTO]);

    const res = await request(app).get('/api/v1/events');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
    expect(mockListEvents).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ upcoming: true }),
    );
  });

  it('returns 200 filtered by tag', async () => {
    mockListEvents.mockResolvedValue([EVENT_DTO]);

    const res = await request(app).get('/api/v1/events?tag=SOCIAL');

    expect(res.status).toBe(200);
    expect(mockListEvents).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ tag: 'SOCIAL' }),
    );
  });

  it('passes limit to service when provided', async () => {
    mockListEvents.mockResolvedValue([]);

    const res = await request(app).get('/api/v1/events?limit=5');

    expect(res.status).toBe(200);
    expect(mockListEvents).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ limit: 5 }),
    );
  });

  it('returns 400 when tag is not a valid EventTag', async () => {
    const res = await request(app).get('/api/v1/events?tag=INVALID_TAG');
    expect(res.status).toBe(400);
  });

  it('returns 400 when limit exceeds 100', async () => {
    const res = await request(app).get('/api/v1/events?limit=200');
    expect(res.status).toBe(400);
  });
});

// ── GET /api/v1/events/:eventId ───────────────────────────────────────────────

describe('GET /api/v1/events/:eventId', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with event DTO', async () => {
    mockGetEvent.mockResolvedValue(EVENT_DTO);

    const res = await request(app).get(`/api/v1/events/${EVENT_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(EVENT_ID);
    expect(mockGetEvent).toHaveBeenCalledWith(EVENT_ID, USER_ID);
  });

  it('returns 404 when event does not exist', async () => {
    mockGetEvent.mockRejectedValueOnce(new EventNotFoundError());

    const res = await request(app).get(`/api/v1/events/${EVENT_ID}`);
    expect(res.status).toBe(404);
  });

  it('returns 400 when eventId is not a UUID', async () => {
    const res = await request(app).get('/api/v1/events/not-a-uuid');
    expect(res.status).toBe(400);
  });
});

// ── POST /api/v1/events/:eventId/rsvp ────────────────────────────────────────

describe('POST /api/v1/events/:eventId/rsvp', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with RSVP confirmed message', async () => {
    mockRsvpToEvent.mockResolvedValue(undefined);

    const res = await request(app).post(`/api/v1/events/${EVENT_ID}/rsvp`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeNull();
    expect(mockRsvpToEvent).toHaveBeenCalledWith(EVENT_ID, USER_ID);
  });

  it('returns 409 when already RSVP\'d', async () => {
    mockRsvpToEvent.mockRejectedValueOnce(new AlreadyRsvpdError());

    const res = await request(app).post(`/api/v1/events/${EVENT_ID}/rsvp`);
    expect(res.status).toBe(409);
  });

  it('returns 409 when event is at full capacity', async () => {
    mockRsvpToEvent.mockRejectedValueOnce(new EventFullError());

    const res = await request(app).post(`/api/v1/events/${EVENT_ID}/rsvp`);
    expect(res.status).toBe(409);
  });

  it('returns 409 when event is not upcoming', async () => {
    mockRsvpToEvent.mockRejectedValueOnce(new EventNotUpcomingError());

    const res = await request(app).post(`/api/v1/events/${EVENT_ID}/rsvp`);
    expect(res.status).toBe(409);
  });

  it('returns 400 when eventId is not a UUID', async () => {
    const res = await request(app).post('/api/v1/events/not-a-uuid/rsvp');
    expect(res.status).toBe(400);
  });
});

// ── DELETE /api/v1/events/:eventId/rsvp ──────────────────────────────────────

describe('DELETE /api/v1/events/:eventId/rsvp', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 on successful RSVP cancellation', async () => {
    mockCancelRsvp.mockResolvedValue(undefined);

    const res = await request(app).delete(`/api/v1/events/${EVENT_ID}/rsvp`);

    expect(res.status).toBe(200);
    expect(res.body.data).toBeNull();
    expect(mockCancelRsvp).toHaveBeenCalledWith(EVENT_ID, USER_ID);
  });

  it('returns 404 when RSVP does not exist', async () => {
    mockCancelRsvp.mockRejectedValueOnce(new NotRsvpdError());

    const res = await request(app).delete(`/api/v1/events/${EVENT_ID}/rsvp`);
    expect(res.status).toBe(404);
  });
});

// ── GET /api/v1/events/:eventId/attendees ────────────────────────────────────

describe('GET /api/v1/events/:eventId/attendees', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with attendees list', async () => {
    mockGetEventAttendees.mockResolvedValue([ATTENDEE_DTO]);

    const res = await request(app).get(`/api/v1/events/${EVENT_ID}/attendees`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
    expect(mockGetEventAttendees).toHaveBeenCalledWith(EVENT_ID);
  });

  it('returns 404 when event does not exist', async () => {
    mockGetEventAttendees.mockRejectedValueOnce(new EventNotFoundError());

    const res = await request(app).get(`/api/v1/events/${EVENT_ID}/attendees`);
    expect(res.status).toBe(404);
  });
});

// ── GET /api/v1/events/calendar (EVENT-006) ───────────────────────────────────

const MILESTONE = {
  type: 'INTRO_DROP',
  title: 'Weekly Introduction Drop',
  scheduledAt: '2026-06-08T09:00:00.000Z',
};

describe('GET /api/v1/events/calendar', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with milestone list', async () => {
    mockGetEventCalendar.mockResolvedValue([MILESTONE]);

    const res = await request(app).get('/api/v1/events/calendar');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].type).toBe('INTRO_DROP');
    expect(res.body.meta.total).toBe(1);
    expect(mockGetEventCalendar).toHaveBeenCalledTimes(1);
  });

  it('returns 200 with empty array when no milestones', async () => {
    mockGetEventCalendar.mockResolvedValue([]);

    const res = await request(app).get('/api/v1/events/calendar');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('returns 500 when service throws', async () => {
    mockGetEventCalendar.mockRejectedValueOnce(new Error('DB error'));

    const res = await request(app).get('/api/v1/events/calendar');
    expect(res.status).toBe(500);
  });
});

// ── POST /admin/events/:eventId/process-attendance (EVENT-007) ────────────────

describe('POST /admin/events/:eventId/process-attendance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnqueueScoreRecompute.mockResolvedValue(undefined);
  });

  it('returns 200 with pairsFound when attendees exist', async () => {
    mockGetCoAttendancePairs.mockResolvedValue([
      { userAId: 'user-a', userBId: 'user-b' },
      { userAId: 'user-a', userBId: 'user-c' },
    ]);

    const res = await request(app)
      .post(`/admin/events/${EVENT_ID}/process-attendance`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.pairsFound).toBe(2);
    expect(mockEnqueueScoreRecompute).toHaveBeenCalledTimes(1);
  });

  it('returns 200 with pairsFound=0 and does not enqueue when no pairs', async () => {
    mockGetCoAttendancePairs.mockResolvedValue([]);

    const res = await request(app)
      .post(`/admin/events/${EVENT_ID}/process-attendance`);

    expect(res.status).toBe(200);
    expect(res.body.data.pairsFound).toBe(0);
    expect(mockEnqueueScoreRecompute).not.toHaveBeenCalled();
  });

  it('returns 404 when event does not exist', async () => {
    mockGetCoAttendancePairs.mockRejectedValueOnce(new EventNotFoundError());

    const res = await request(app)
      .post(`/admin/events/${EVENT_ID}/process-attendance`);
    expect(res.status).toBe(404);
  });

  it('returns 400 when eventId is not a UUID', async () => {
    const res = await request(app)
      .post('/admin/events/not-a-uuid/process-attendance');
    expect(res.status).toBe(400);
  });
});
