import { otpVerifyService, OtpInvalidError, DeviceLimitError } from '../otp-verify.service.js';
import { UserRole } from '@abroad-matrimony/shared';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockVerifyOtp = jest.fn();
const mockIssueTokenPair = jest.fn();
const mockStoreRefreshToken = jest.fn();
const mockPublish = jest.fn();

jest.mock('../otp.service.js', () => ({
  verifyOtp: (...args: unknown[]) => mockVerifyOtp(...args),
}));

jest.mock('../jwt.service.js', () => ({
  issueTokenPair: (...args: unknown[]) => mockIssueTokenPair(...args),
}));

jest.mock('../refresh-token.service.js', () => ({
  storeRefreshToken: (...args: unknown[]) => mockStoreRefreshToken(...args),
}));

jest.mock('@abroad-matrimony/event-bus', () => ({
  publish: (...args: unknown[]) => mockPublish(...args),
}));

const mockUserFindUnique = jest.fn();
const mockUserCreate = jest.fn();
const mockUserUpdate = jest.fn();
const mockDeviceFindUnique = jest.fn();
const mockDeviceCreate = jest.fn();
const mockDeviceUpdate = jest.fn();
const mockDeviceCount = jest.fn();

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    user: {
      findUnique: (...a: unknown[]) => mockUserFindUnique(...a),
      create: (...a: unknown[]) => mockUserCreate(...a),
      update: (...a: unknown[]) => mockUserUpdate(...a),
    },
    device: {
      findUnique: (...a: unknown[]) => mockDeviceFindUnique(...a),
      create: (...a: unknown[]) => mockDeviceCreate(...a),
      update: (...a: unknown[]) => mockDeviceUpdate(...a),
      count: (...a: unknown[]) => mockDeviceCount(...a),
    },
  },
}));

jest.mock('@abroad-matrimony/shared', () => ({
  CLOUD_EVENT_TYPES: { USER_REGISTERED: 'com.abroadmatrimony.user.registered' },
  MAX_DEVICES_PER_USER: 5,
  UserRole: { USER: 'USER', VERIFIED: 'VERIFIED', FOUNDING_MEMBER: 'FOUNDING_MEMBER', SUSPENDED: 'SUSPENDED' },
  CACHE_TTL: { REFRESH_TOKEN_SECONDS: 2592000 },
}));

jest.mock('@abroad-matrimony/config', () => ({
  getEnv: () => ({ TRUSTED_DEVICE_TTL_DAYS: 90 }),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────

const INPUT = {
  phone: '+919876543210',
  code: '123456',
  deviceFingerprint: 'fingerprint-abc-123',
  deviceName: 'iPhone 15',
  platform: 'ios',
};

const EXISTING_USER = {
  id: 'user-uuid-1',
  phone: '+919876543210',
  email: null,
  role: 'USER',
  isPhoneVerified: true,
  isEmailVerified: false,
  createdAt: new Date('2026-01-01'),
};

const NEW_DEVICE = {
  id: 'device-uuid-1',
  userId: EXISTING_USER.id,
  fingerprint: INPUT.deviceFingerprint,
  name: INPUT.deviceName,
  platform: INPUT.platform,
  lastSeenAt: new Date(),
};

const TOKEN_PAIR = {
  accessToken: 'access.token.here',
  refreshToken: 'refresh.token.here',
  tokenId: 'token-uuid-1',
  expiresIn: 900,
};

// ── Tests ─────────────────────────────────────────────────────────────────

describe('otpVerifyService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVerifyOtp.mockResolvedValue(true);
    mockIssueTokenPair.mockReturnValue(TOKEN_PAIR);
    mockStoreRefreshToken.mockResolvedValue(undefined);
    mockPublish.mockResolvedValue(undefined);
    mockDeviceFindUnique.mockResolvedValue(NEW_DEVICE);
    mockDeviceUpdate.mockResolvedValue(NEW_DEVICE);
  });

  describe('returning user — existing device', () => {
    beforeEach(() => {
      mockUserFindUnique.mockResolvedValue(EXISTING_USER);
      mockDeviceFindUnique.mockResolvedValue(NEW_DEVICE);
    });

    it('returns accessToken, refreshToken, expiresIn, and user DTO', async () => {
      const result = await otpVerifyService(INPUT);

      expect(result.accessToken).toBe(TOKEN_PAIR.accessToken);
      expect(result.refreshToken).toBe(TOKEN_PAIR.refreshToken);
      expect(result.expiresIn).toBe(900);
      expect(result.user.id).toBe(EXISTING_USER.id);
    });

    it('does not publish USER_REGISTERED for returning user', async () => {
      await otpVerifyService(INPUT);
      expect(mockPublish).not.toHaveBeenCalled();
    });

    it('updates device lastSeenAt', async () => {
      await otpVerifyService(INPUT);
      expect(mockDeviceUpdate).toHaveBeenCalled();
    });
  });

  describe('new user — new device', () => {
    beforeEach(() => {
      mockUserFindUnique.mockResolvedValue(null);
      mockUserCreate.mockResolvedValue({ ...EXISTING_USER, isPhoneVerified: true });
      mockDeviceFindUnique.mockResolvedValue(null);
      mockDeviceCount.mockResolvedValue(0);
      mockDeviceCreate.mockResolvedValue(NEW_DEVICE);
    });

    it('creates new user record', async () => {
      await otpVerifyService(INPUT);
      expect(mockUserCreate).toHaveBeenCalledWith({
        data: { phone: INPUT.phone, isPhoneVerified: true },
      });
    });

    it('publishes USER_REGISTERED after DB write', async () => {
      await otpVerifyService(INPUT);
      expect(mockPublish).toHaveBeenCalledWith(
        'com.abroadmatrimony.user.registered',
        expect.objectContaining({ userId: EXISTING_USER.id }),
        expect.stringContaining('user:'),
      );
    });

    it('stores refresh token', async () => {
      await otpVerifyService(INPUT);
      expect(mockStoreRefreshToken).toHaveBeenCalledWith(
        TOKEN_PAIR.tokenId,
        EXISTING_USER.id,
        NEW_DEVICE.id,
        TOKEN_PAIR.refreshToken,
        expect.any(Date),
      );
    });
  });

  describe('error cases', () => {
    it('throws OtpInvalidError when OTP verification fails', async () => {
      mockVerifyOtp.mockResolvedValueOnce(false);
      mockUserFindUnique.mockResolvedValue(EXISTING_USER);

      await expect(otpVerifyService(INPUT)).rejects.toThrow(OtpInvalidError);
    });

    it('does not call DB when OTP is invalid', async () => {
      mockVerifyOtp.mockResolvedValueOnce(false);

      await expect(otpVerifyService(INPUT)).rejects.toThrow(OtpInvalidError);
      expect(mockUserFindUnique).not.toHaveBeenCalled();
    });

    it('throws DeviceLimitError when device count is at MAX', async () => {
      mockUserFindUnique.mockResolvedValue(EXISTING_USER);
      mockDeviceFindUnique.mockResolvedValue(null);
      mockDeviceCount.mockResolvedValue(5);

      await expect(otpVerifyService(INPUT)).rejects.toThrow(DeviceLimitError);
    });

    it('does not throw DeviceLimitError when device fingerprint already exists', async () => {
      mockUserFindUnique.mockResolvedValue(EXISTING_USER);
      mockDeviceFindUnique.mockResolvedValue(NEW_DEVICE);
      mockDeviceCount.mockResolvedValue(5);

      await expect(otpVerifyService(INPUT)).resolves.toBeDefined();
      expect(mockDeviceCount).not.toHaveBeenCalled();
    });
  });
});
