import { BrevoEmailAdapter } from '../adapters/email/brevo.email.adapter.js';
import { MockEmailAdapter } from '../adapters/email/mock.email.adapter.js';
import { getEmailAdapter, _resetEmailAdapter } from '../adapters/email/index.js';
import type { EmailPayload } from '../types/notification.types.js';

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

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

const { getEnv } = jest.requireMock('@abroad-matrimony/config') as { getEnv: jest.Mock };

// ── Test helpers ──────────────────────────────────────────────────────────────

const PAYLOAD: EmailPayload = {
  to:       'user@example.com',
  toName:   'Test User',
  subject:  'Welcome to Abroad Matrimony',
  htmlBody: '<p>Hello!</p>',
  textBody: 'Hello!',
};

// ── BrevoEmailAdapter unit tests ──────────────────────────────────────────────

describe('BrevoEmailAdapter', () => {
  let adapter: BrevoEmailAdapter;

  beforeEach(() => {
    adapter = new BrevoEmailAdapter('test-api-key', 'noreply@test.com', 'Test');
    mockFetch.mockReset();
  });

  it('calls the Brevo API with correct headers and body on success', async () => {
    mockFetch.mockResolvedValue({ ok: true, text: jest.fn() });

    await adapter.send(PAYLOAD);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.brevo.com/v3/smtp/email',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'api-key':      'test-api-key',
        }),
      }),
    );

    const callArgs = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(callArgs[1].body as string) as Record<string, unknown>;
    expect(body).toMatchObject({
      sender:      { email: 'noreply@test.com', name: 'Test' },
      to:          [{ email: 'user@example.com', name: 'Test User' }],
      subject:     'Welcome to Abroad Matrimony',
      htmlContent: '<p>Hello!</p>',
      textContent: 'Hello!',
    });
  });

  it('omits textContent when textBody is not provided', async () => {
    mockFetch.mockResolvedValue({ ok: true, text: jest.fn() });

    await adapter.send({ ...PAYLOAD, textBody: undefined });

    const callArgs = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(callArgs[1].body as string) as Record<string, unknown>;
    expect(body).not.toHaveProperty('textContent');
  });

  it('omits recipient name when toName is not provided', async () => {
    mockFetch.mockResolvedValue({ ok: true, text: jest.fn() });

    await adapter.send({ ...PAYLOAD, toName: undefined });

    const callArgs = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(callArgs[1].body as string) as Record<string, unknown>;
    expect((body.to as Array<{ email: string; name?: string }>)[0]).not.toHaveProperty('name');
  });

  it('throws when Brevo returns a non-2xx response', async () => {
    mockFetch.mockResolvedValue({
      ok:   false,
      status: 401,
      text: jest.fn().mockResolvedValue('Unauthorized'),
    });

    await expect(adapter.send(PAYLOAD)).rejects.toThrow('Brevo email failed: HTTP 401');
  });

  it('throws when fetch rejects (network error)', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    await expect(adapter.send(PAYLOAD)).rejects.toThrow('Network error');
  });
});

// ── MockEmailAdapter ──────────────────────────────────────────────────────────

describe('MockEmailAdapter', () => {
  let adapter: MockEmailAdapter;

  beforeEach(() => {
    adapter = new MockEmailAdapter();
    adapter._reset();
    mockFetch.mockReset();
  });

  it('records sent emails without network calls', async () => {
    await adapter.send(PAYLOAD);

    expect(adapter.sent).toHaveLength(1);
    expect(adapter.sent[0]).toEqual(PAYLOAD);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('_reset() clears the sent list', async () => {
    await adapter.send(PAYLOAD);
    adapter._reset();
    expect(adapter.sent).toHaveLength(0);
  });
});

// ── getEmailAdapter() factory ─────────────────────────────────────────────────

describe('getEmailAdapter()', () => {
  beforeEach(() => {
    _resetEmailAdapter();
  });

  it('returns BrevoEmailAdapter when BREVO_API_KEY is set', () => {
    getEnv.mockReturnValue({
      BREVO_API_KEY:    'key-123',
      BREVO_FROM_EMAIL: 'no-reply@am.com',
      BREVO_FROM_NAME:  'Abroad Matrimony',
    });

    const adapter = getEmailAdapter();
    expect(adapter).toBeInstanceOf(BrevoEmailAdapter);
  });

  it('returns MockEmailAdapter when BREVO_API_KEY is absent', () => {
    getEnv.mockReturnValue({
      BREVO_API_KEY:    undefined,
      BREVO_FROM_EMAIL: 'no-reply@am.com',
      BREVO_FROM_NAME:  'Abroad Matrimony',
    });

    const adapter = getEmailAdapter();
    expect(adapter).toBeInstanceOf(MockEmailAdapter);
  });

  it('returns the same instance on repeated calls (singleton)', () => {
    getEnv.mockReturnValue({
      BREVO_API_KEY:    'key-123',
      BREVO_FROM_EMAIL: 'no-reply@am.com',
      BREVO_FROM_NAME:  'Abroad Matrimony',
    });

    expect(getEmailAdapter()).toBe(getEmailAdapter());
  });
});
