import { TwilioSmsAdapter } from '../adapters/sms/twilio.sms.adapter.js';
import { MockSmsAdapter } from '../adapters/sms/mock.sms.adapter.js';
import { getSmsAdapter, _resetSmsAdapter } from '../adapters/sms/index.js';
import type { SmsPayload } from '../types/notification.types.js';

// ── Mock dependencies ─────────────────────────────────────────────────────────

jest.mock('@abroad-matrimony/logger', () => ({
  createChildLogger: () => ({
    info:  jest.fn(),
    warn:  jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

jest.mock('@abroad-matrimony/config', () => ({
  getEnv: jest.fn(),
}));

const mockMessagesCreate = jest.fn();

jest.mock('twilio', () => {
  return jest.fn(() => ({
    messages: { create: mockMessagesCreate },
  }));
});

const { getEnv } = jest.requireMock('@abroad-matrimony/config') as { getEnv: jest.Mock };

// ── Test helpers ──────────────────────────────────────────────────────────────

const PAYLOAD: SmsPayload = {
  to:   '+919876543210',
  body: 'Your weekly intro drop is live! Open the app.',
};

// ── TwilioSmsAdapter unit tests ───────────────────────────────────────────────

describe('TwilioSmsAdapter', () => {
  let adapter: TwilioSmsAdapter;

  beforeEach(() => {
    mockMessagesCreate.mockReset();
    adapter = new TwilioSmsAdapter('ACtest', 'auth-token', '+10000000000');
  });

  it('sends SMS with correct from/to/body on success', async () => {
    mockMessagesCreate.mockResolvedValue({ sid: 'SM123' });

    await adapter.send(PAYLOAD);

    expect(mockMessagesCreate).toHaveBeenCalledWith({
      from: '+10000000000',
      to:   '+919876543210',
      body: 'Your weekly intro drop is live! Open the app.',
    });
  });

  it('throws when Twilio rejects the request', async () => {
    mockMessagesCreate.mockRejectedValue(new Error('Invalid phone number'));

    await expect(adapter.send(PAYLOAD)).rejects.toThrow('Invalid phone number');
  });
});

// ── MockSmsAdapter ────────────────────────────────────────────────────────────

describe('MockSmsAdapter', () => {
  let adapter: MockSmsAdapter;

  beforeEach(() => {
    adapter = new MockSmsAdapter();
    adapter._reset();
    mockMessagesCreate.mockReset();
  });

  it('records sent SMS messages without calling Twilio', async () => {
    await adapter.send(PAYLOAD);

    expect(adapter.sent).toHaveLength(1);
    expect(adapter.sent[0]).toEqual(PAYLOAD);
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  it('_reset() clears the sent list', async () => {
    await adapter.send(PAYLOAD);
    adapter._reset();
    expect(adapter.sent).toHaveLength(0);
  });
});

// ── getSmsAdapter() factory ───────────────────────────────────────────────────

describe('getSmsAdapter()', () => {
  beforeEach(() => {
    _resetSmsAdapter();
  });

  it('returns TwilioSmsAdapter when all Twilio vars are set', () => {
    getEnv.mockReturnValue({
      TWILIO_ACCOUNT_SID:   'ACtest',
      TWILIO_AUTH_TOKEN:    'auth-token',
      TWILIO_PHONE_NUMBER:  '+10000000000',
    });

    const adapter = getSmsAdapter();
    expect(adapter).toBeInstanceOf(TwilioSmsAdapter);
  });

  it('returns MockSmsAdapter when TWILIO_PHONE_NUMBER is absent', () => {
    getEnv.mockReturnValue({
      TWILIO_ACCOUNT_SID:   'ACtest',
      TWILIO_AUTH_TOKEN:    'auth-token',
      TWILIO_PHONE_NUMBER:  undefined,
    });

    const adapter = getSmsAdapter();
    expect(adapter).toBeInstanceOf(MockSmsAdapter);
  });

  it('returns MockSmsAdapter when TWILIO_ACCOUNT_SID is absent', () => {
    getEnv.mockReturnValue({
      TWILIO_ACCOUNT_SID:  undefined,
      TWILIO_AUTH_TOKEN:   undefined,
      TWILIO_PHONE_NUMBER: '+10000000000',
    });

    const adapter = getSmsAdapter();
    expect(adapter).toBeInstanceOf(MockSmsAdapter);
  });

  it('returns the same instance on repeated calls (singleton)', () => {
    getEnv.mockReturnValue({
      TWILIO_ACCOUNT_SID:  'ACtest',
      TWILIO_AUTH_TOKEN:   'auth-token',
      TWILIO_PHONE_NUMBER: '+10000000000',
    });

    expect(getSmsAdapter()).toBe(getSmsAdapter());
  });
});
