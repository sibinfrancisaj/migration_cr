import { getOtpAdapter } from '../../adapters/index.js';
import { TwilioOtpAdapter } from '../../adapters/twilio.otp.adapter.js';
import { MockOtpAdapter } from '../../adapters/mock.otp.adapter.js';

// ── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('@abroad-matrimony/config');

const { getEnv } = jest.requireMock('@abroad-matrimony/config') as {
  getEnv: jest.Mock;
};

// ── Tests ─────────────────────────────────────────────────────────────────

describe('getOtpAdapter', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns TwilioOtpAdapter when all three Twilio env vars are set', () => {
    getEnv.mockReturnValue({
      TWILIO_ACCOUNT_SID: 'ACtest',
      TWILIO_AUTH_TOKEN: 'token',
      TWILIO_VERIFY_SERVICE_SID: 'VAtest',
    });

    const adapter = getOtpAdapter();

    expect(adapter).toBeInstanceOf(TwilioOtpAdapter);
  });

  it('returns MockOtpAdapter when TWILIO_ACCOUNT_SID is absent', () => {
    getEnv.mockReturnValue({
      TWILIO_ACCOUNT_SID: undefined,
      TWILIO_AUTH_TOKEN: 'token',
      TWILIO_VERIFY_SERVICE_SID: 'VAtest',
    });

    expect(getOtpAdapter()).toBeInstanceOf(MockOtpAdapter);
  });

  it('returns MockOtpAdapter when TWILIO_AUTH_TOKEN is absent', () => {
    getEnv.mockReturnValue({
      TWILIO_ACCOUNT_SID: 'ACtest',
      TWILIO_AUTH_TOKEN: undefined,
      TWILIO_VERIFY_SERVICE_SID: 'VAtest',
    });

    expect(getOtpAdapter()).toBeInstanceOf(MockOtpAdapter);
  });

  it('returns MockOtpAdapter when TWILIO_VERIFY_SERVICE_SID is absent', () => {
    getEnv.mockReturnValue({
      TWILIO_ACCOUNT_SID: 'ACtest',
      TWILIO_AUTH_TOKEN: 'token',
      TWILIO_VERIFY_SERVICE_SID: undefined,
    });

    expect(getOtpAdapter()).toBeInstanceOf(MockOtpAdapter);
  });
});
