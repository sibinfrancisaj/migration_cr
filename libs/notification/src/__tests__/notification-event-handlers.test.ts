import { createNotificationEventHandlers } from '../events/notification-event-handlers.js';
import { EVENT_HANDLER_NAMES, EVENT_PUSH_TYPES } from '../events/event-notification.constants.js';
import { NotificationType } from '../types/notification.types.js';
import { CLOUD_EVENT_TYPES, VerificationStatus } from '@abroad-matrimony/shared';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockDeviceFindMany = jest.fn();
const mockProfileFindUnique = jest.fn();

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    device:  { findMany:   (...a: unknown[]) => mockDeviceFindMany(...a) },
    profile: { findUnique: (...a: unknown[]) => mockProfileFindUnique(...a) },
  },
}));

jest.mock('@abroad-matrimony/logger', () => ({
  createChildLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

const mockEnqueue = jest.fn();
jest.mock('../notification.worker.js', () => ({
  enqueueNotification: (...a: unknown[]) => mockEnqueue(...a),
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

const REDIS = 'redis://x';
const EVENT_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const SENDER = 'user-sender';
const RECEIVER = 'user-receiver';

function makeEvent<T>(type: string, data: T) {
  return { id: EVENT_ID, source: 'test', type, time: new Date().toISOString(), dataContentType: 'application/json', data };
}

function handlerFor(type: string) {
  const handlers = createNotificationEventHandlers(REDIS)[type];
  expect(handlers).toHaveLength(1);
  return handlers[0];
}

beforeEach(() => {
  jest.clearAllMocks();
  mockEnqueue.mockResolvedValue(undefined);
  mockDeviceFindMany.mockResolvedValue([
    { id: 'dev-1', pushToken: 'tok-1' },
    { id: 'dev-2', pushToken: 'tok-2' },
  ]);
  mockProfileFindUnique.mockResolvedValue({ name: 'Priya' });
});

// ── Registry ───────────────────────────────────────────────────────────────────

describe('createNotificationEventHandlers', () => {
  it('registers handlers for connection, verification and membership events', () => {
    expect(Object.keys(createNotificationEventHandlers(REDIS)).sort()).toEqual([
      CLOUD_EVENT_TYPES.CONNECTION_ACCEPTED,
      CLOUD_EVENT_TYPES.CONNECTION_SENT,
      CLOUD_EVENT_TYPES.MEMBERSHIP_ACTIVATED,
      CLOUD_EVENT_TYPES.VERIFICATION_REVIEWED,
    ].sort());
  });

  it('does not handle MESSAGE_SENT (messaging already pushes directly)', () => {
    expect(createNotificationEventHandlers(REDIS)[CLOUD_EVENT_TYPES.MESSAGE_SENT]).toBeUndefined();
  });
});

// ── CONNECTION_SENT ────────────────────────────────────────────────────────────

describe('CONNECTION_SENT handler', () => {
  const event = makeEvent(CLOUD_EVENT_TYPES.CONNECTION_SENT, { connectionId: 'conn-1', senderId: SENDER, receiverId: RECEIVER });

  it('pushes to every device of the receiver, naming the sender', async () => {
    await handlerFor(CLOUD_EVENT_TYPES.CONNECTION_SENT).handle(event);

    expect(mockProfileFindUnique).toHaveBeenCalledWith({ where: { userId: SENDER }, select: { name: true } });
    expect(mockDeviceFindMany).toHaveBeenCalledWith({
      where: { userId: RECEIVER, pushToken: { not: null } },
      select: { id: true, pushToken: true },
    });
    expect(mockEnqueue).toHaveBeenCalledTimes(2);
    expect(mockEnqueue).toHaveBeenCalledWith(
      REDIS,
      {
        type: NotificationType.PUSH,
        payload: {
          deviceToken: 'tok-1',
          userId: RECEIVER,
          title: 'New connection request',
          body: 'Priya would like to connect with you',
          data: { type: EVENT_PUSH_TYPES.CONNECTION_REQUEST, connectionId: 'conn-1' },
        },
      },
      { jobId: `${EVENT_ID}:${EVENT_HANDLER_NAMES.CONNECTION_SENT}:dev-1` },
    );
  });

  it('uses a per-device jobId derived from the event id so retries do not re-send', async () => {
    await handlerFor(CLOUD_EVENT_TYPES.CONNECTION_SENT).handle(event);
    const jobIds = mockEnqueue.mock.calls.map((c) => c[2].jobId);
    expect(jobIds).toEqual([
      `${EVENT_ID}:${EVENT_HANDLER_NAMES.CONNECTION_SENT}:dev-1`,
      `${EVENT_ID}:${EVENT_HANDLER_NAMES.CONNECTION_SENT}:dev-2`,
    ]);
  });

  it('falls back to a generic name when the sender has no profile', async () => {
    mockProfileFindUnique.mockResolvedValue(null);
    await handlerFor(CLOUD_EVENT_TYPES.CONNECTION_SENT).handle(event);
    expect(mockEnqueue.mock.calls[0][1].payload.body).toBe('Someone would like to connect with you');
  });

  it('enqueues nothing when the receiver has no push tokens', async () => {
    mockDeviceFindMany.mockResolvedValue([]);
    await handlerFor(CLOUD_EVENT_TYPES.CONNECTION_SENT).handle(event);
    expect(mockEnqueue).not.toHaveBeenCalled();
  });

  it('propagates enqueue failures so the event is retried', async () => {
    mockEnqueue.mockRejectedValue(new Error('Redis down'));
    await expect(handlerFor(CLOUD_EVENT_TYPES.CONNECTION_SENT).handle(event)).rejects.toThrow('Redis down');
  });

  it('propagates DB failures so the event is retried', async () => {
    mockDeviceFindMany.mockRejectedValue(new Error('DB down'));
    await expect(handlerFor(CLOUD_EVENT_TYPES.CONNECTION_SENT).handle(event)).rejects.toThrow('DB down');
  });
});

// ── CONNECTION_ACCEPTED ────────────────────────────────────────────────────────

describe('CONNECTION_ACCEPTED handler', () => {
  const event = makeEvent(CLOUD_EVENT_TYPES.CONNECTION_ACCEPTED, {
    connectionId: 'conn-1', senderId: SENDER, receiverId: RECEIVER, matchId: 'match-1',
  });

  it('pushes to the original sender, naming the receiver who accepted', async () => {
    await handlerFor(CLOUD_EVENT_TYPES.CONNECTION_ACCEPTED).handle(event);

    expect(mockProfileFindUnique).toHaveBeenCalledWith({ where: { userId: RECEIVER }, select: { name: true } });
    expect(mockDeviceFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: SENDER, pushToken: { not: null } } }));
    const payload = mockEnqueue.mock.calls[0][1].payload;
    expect(payload.userId).toBe(SENDER);
    expect(payload.body).toBe('Priya accepted your connection request. Say hello!');
    expect(payload.data).toEqual({ type: EVENT_PUSH_TYPES.CONNECTION_ACCEPTED, connectionId: 'conn-1', matchId: 'match-1' });
  });
});

// ── VERIFICATION_REVIEWED ──────────────────────────────────────────────────────

describe('VERIFICATION_REVIEWED handler', () => {
  it('sends the approved copy and deep-link type on approval', async () => {
    const event = makeEvent(CLOUD_EVENT_TYPES.VERIFICATION_REVIEWED, {
      verificationId: 'ver-1', userId: RECEIVER, status: VerificationStatus.APPROVED,
    });
    await handlerFor(CLOUD_EVENT_TYPES.VERIFICATION_REVIEWED).handle(event);

    const payload = mockEnqueue.mock.calls[0][1].payload;
    expect(payload.title).toBe('You are verified');
    expect(payload.data).toEqual({ type: EVENT_PUSH_TYPES.VERIFICATION_APPROVED, verificationId: 'ver-1' });
  });

  it('sends the rejected copy on rejection without leaking the admin reason', async () => {
    const event = makeEvent(CLOUD_EVENT_TYPES.VERIFICATION_REVIEWED, {
      verificationId: 'ver-1', userId: RECEIVER, status: VerificationStatus.REJECTED, reason: 'blurry selfie',
    });
    await handlerFor(CLOUD_EVENT_TYPES.VERIFICATION_REVIEWED).handle(event);

    const payload = mockEnqueue.mock.calls[0][1].payload;
    expect(payload.title).toBe('Verification needs another try');
    expect(payload.data.type).toBe(EVENT_PUSH_TYPES.VERIFICATION_REJECTED);
    expect(JSON.stringify(payload)).not.toContain('blurry selfie');
  });

  it('does not look up a display name', async () => {
    const event = makeEvent(CLOUD_EVENT_TYPES.VERIFICATION_REVIEWED, {
      verificationId: 'ver-1', userId: RECEIVER, status: VerificationStatus.APPROVED,
    });
    await handlerFor(CLOUD_EVENT_TYPES.VERIFICATION_REVIEWED).handle(event);
    expect(mockProfileFindUnique).not.toHaveBeenCalled();
  });
});

// ── MEMBERSHIP_ACTIVATED ───────────────────────────────────────────────────────

describe('MEMBERSHIP_ACTIVATED handler', () => {
  it('pushes the welcome message with the plan in data', async () => {
    const event = makeEvent(CLOUD_EVENT_TYPES.MEMBERSHIP_ACTIVATED, { userId: RECEIVER, plan: 'FOUNDING_MEMBER' });
    await handlerFor(CLOUD_EVENT_TYPES.MEMBERSHIP_ACTIVATED).handle(event);

    const payload = mockEnqueue.mock.calls[0][1].payload;
    expect(payload.title).toBe('Welcome, Founding Member');
    expect(payload.data).toEqual({ type: EVENT_PUSH_TYPES.MEMBERSHIP_ACTIVATED, plan: 'FOUNDING_MEMBER' });
  });
});
