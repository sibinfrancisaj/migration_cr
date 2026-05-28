import { MockPushAdapter } from '../adapters/push/mock.push.adapter.js';
import { getPushAdapter, _resetPushAdapter } from '../adapters/push/index.js';
import type { PushPayload } from '../types/notification.types.js';

// ── Mock dependencies ─────────────────────────────────────────────────────────

jest.mock('@abroad-matrimony/logger', () => ({
  createChildLogger: () => ({
    info:  jest.fn(),
    warn:  jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

jest.mock('@abroad-matrimony/firebase', () => ({
  isFirebaseConfigured: jest.fn(),
  getFirebaseMessaging: jest.fn(),
}));

const {
  isFirebaseConfigured,
  getFirebaseMessaging,
} = jest.requireMock('@abroad-matrimony/firebase') as {
  isFirebaseConfigured: jest.Mock;
  getFirebaseMessaging: jest.Mock;
};

// ── Test helpers ──────────────────────────────────────────────────────────────

const PAYLOAD: PushPayload = {
  deviceToken: 'fcm-token-abc123',
  title:       'New connection request!',
  body:        'Priya sent you a connection request.',
  data:        { screen: 'connections', userId: 'user-abc' },
};

// ── MockPushAdapter ───────────────────────────────────────────────────────────

describe('MockPushAdapter', () => {
  let adapter: MockPushAdapter;

  beforeEach(() => {
    adapter = new MockPushAdapter();
    adapter._reset();
  });

  it('records sent pushes without calling FCM', async () => {
    await adapter.send(PAYLOAD);

    expect(adapter.sent).toHaveLength(1);
    expect(adapter.sent[0]).toEqual(PAYLOAD);
    expect(getFirebaseMessaging).not.toHaveBeenCalled();
  });

  it('_reset() clears the sent list', async () => {
    await adapter.send(PAYLOAD);
    adapter._reset();
    expect(adapter.sent).toHaveLength(0);
  });
});

// ── getPushAdapter() factory ──────────────────────────────────────────────────

describe('getPushAdapter()', () => {
  beforeEach(() => {
    _resetPushAdapter();
    jest.clearAllMocks();
  });

  it('returns MockPushAdapter when Firebase is not configured', () => {
    isFirebaseConfigured.mockReturnValue(false);

    const { MockPushAdapter: MockPush } = jest.requireActual('../adapters/push/mock.push.adapter.js') as { MockPushAdapter: typeof MockPushAdapter };
    const adapter = getPushAdapter();
    expect(adapter).toBeInstanceOf(MockPush);
  });

  it('returns the same instance on repeated calls (singleton)', () => {
    isFirebaseConfigured.mockReturnValue(false);
    expect(getPushAdapter()).toBe(getPushAdapter());
  });
});

// ── FirebasePushAdapter (via mock) ────────────────────────────────────────────
// FirebasePushAdapter wraps getFirebaseMessaging().send() — we test the dispatch
// logic through the worker tests. Here we only validate the mock fallback path.

describe('FirebasePushAdapter dispatch (mocked FCM)', () => {
  const mockSend = jest.fn();

  beforeEach(() => {
    _resetPushAdapter();
    isFirebaseConfigured.mockReturnValue(true);
    getFirebaseMessaging.mockReturnValue({ send: mockSend });
    mockSend.mockReset();
  });

  it('calls FCM send with correct message shape', async () => {
    mockSend.mockResolvedValue('projects/test/messages/123');

    const { FirebasePushAdapter } = await import('../adapters/push/firebase.push.adapter.js');
    const adapter = new FirebasePushAdapter();
    await adapter.send(PAYLOAD);

    expect(mockSend).toHaveBeenCalledWith({
      token: PAYLOAD.deviceToken,
      notification: {
        title: PAYLOAD.title,
        body:  PAYLOAD.body,
      },
      data: PAYLOAD.data,
    });
  });

  it('omits data field when payload.data is undefined', async () => {
    mockSend.mockResolvedValue('projects/test/messages/456');

    const { FirebasePushAdapter } = await import('../adapters/push/firebase.push.adapter.js');
    const adapter = new FirebasePushAdapter();
    await adapter.send({ ...PAYLOAD, data: undefined });

    const call = mockSend.mock.calls[0][0] as Record<string, unknown>;
    expect(call).not.toHaveProperty('data');
  });

  it('throws when FCM rejects', async () => {
    mockSend.mockRejectedValue(new Error('FCM quota exceeded'));

    const { FirebasePushAdapter } = await import('../adapters/push/firebase.push.adapter.js');
    const adapter = new FirebasePushAdapter();
    await expect(adapter.send(PAYLOAD)).rejects.toThrow('FCM quota exceeded');
  });
});
