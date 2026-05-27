import { verifyOtp } from '../otp.service.js';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockVerify = jest.fn();

jest.mock('../adapters/index.js', () => ({
  getOtpAdapter: () => ({ verify: (...args: unknown[]) => mockVerify(...args) }),
}));

// ── Tests ─────────────────────────────────────────────────────────────────

describe('verifyOtp', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns true when adapter verify resolves true', async () => {
    mockVerify.mockResolvedValue(true);
    expect(await verifyOtp('+919876543210', '123456')).toBe(true);
  });

  it('returns false when adapter verify resolves false', async () => {
    mockVerify.mockResolvedValue(false);
    expect(await verifyOtp('+919876543210', '999999')).toBe(false);
  });

  it('passes phone and code to the adapter unchanged', async () => {
    mockVerify.mockResolvedValue(true);
    await verifyOtp('+919876543210', '123456');
    expect(mockVerify).toHaveBeenCalledWith('+919876543210', '123456');
  });
});
