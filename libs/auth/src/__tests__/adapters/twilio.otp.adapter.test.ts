import { TwilioOtpAdapter } from '../../adapters/twilio.otp.adapter.js';

const mockVerificationsCreate = jest.fn();
const mockVerificationChecksCreate = jest.fn();

jest.mock('twilio', () =>
  jest.fn(() => ({
    verify: {
      v2: {
        services: jest.fn(() => ({
          verifications: { create: mockVerificationsCreate },
          verificationChecks: { create: mockVerificationChecksCreate },
        })),
      },
    },
  })),
);

describe('TwilioOtpAdapter', () => {
  let adapter: TwilioOtpAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    adapter = new TwilioOtpAdapter('AC_TEST_SID', 'AUTH_TOKEN', 'VA_SERVICE_SID');
  });

  describe('send', () => {
    it('calls Twilio verifications.create with phone and sms channel', async () => {
      mockVerificationsCreate.mockResolvedValueOnce({ status: 'pending' });

      await adapter.send('+919876543210');

      expect(mockVerificationsCreate).toHaveBeenCalledWith({
        to: '+919876543210',
        channel: 'sms',
      });
    });

    it('propagates Twilio errors to the caller', async () => {
      mockVerificationsCreate.mockRejectedValueOnce(new Error('Twilio error'));

      await expect(adapter.send('+919876543210')).rejects.toThrow('Twilio error');
    });
  });

  describe('verify', () => {
    it('returns true when Twilio status is approved', async () => {
      mockVerificationChecksCreate.mockResolvedValueOnce({ status: 'approved' });

      const result = await adapter.verify('+919876543210', '123456');

      expect(result).toBe(true);
    });

    it('returns false when Twilio status is pending', async () => {
      mockVerificationChecksCreate.mockResolvedValueOnce({ status: 'pending' });

      const result = await adapter.verify('+919876543210', '000000');

      expect(result).toBe(false);
    });

    it('returns false when Twilio status is canceled', async () => {
      mockVerificationChecksCreate.mockResolvedValueOnce({ status: 'canceled' });

      const result = await adapter.verify('+919876543210', '999999');

      expect(result).toBe(false);
    });

    it('propagates Twilio errors to the caller', async () => {
      mockVerificationChecksCreate.mockRejectedValueOnce(new Error('Network error'));

      await expect(adapter.verify('+919876543210', '123456')).rejects.toThrow('Network error');
    });
  });
});
