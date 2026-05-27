import { MockOtpAdapter } from '../../adapters/mock.otp.adapter.js';

describe('MockOtpAdapter', () => {
  let adapter: MockOtpAdapter;

  beforeEach(() => {
    adapter = new MockOtpAdapter();
  });

  describe('send', () => {
    it('resolves without error', async () => {
      await expect(adapter.send('+919876543210')).resolves.toBeUndefined();
    });
  });

  describe('verify', () => {
    it('returns true for the magic code 000000', async () => {
      const result = await adapter.verify('+919876543210', '000000');
      expect(result).toBe(true);
    });

    it('returns false for any other code', async () => {
      const result = await adapter.verify('+919876543210', '123456');
      expect(result).toBe(false);
    });

    it('ignores the phone argument', async () => {
      const a = await adapter.verify('+911111111111', '000000');
      const b = await adapter.verify('+922222222222', '000000');
      expect(a).toBe(true);
      expect(b).toBe(true);
    });
  });
});
