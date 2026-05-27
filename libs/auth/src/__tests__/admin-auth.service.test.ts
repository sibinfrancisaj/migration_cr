import {
  adminLoginService,
  AdminCredentialsError,
  AdminTotpRequiredError,
  AdminTotpInvalidError,
} from '../admin-auth.service.js';
import { AdminRole } from '@abroad-matrimony/shared';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockFindUnique = jest.fn();
const mockUpdate     = jest.fn();

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    adminUser: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update:     (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

const mockBcryptCompare = jest.fn();
const mockBcryptHash    = jest.fn();

jest.mock('bcrypt', () => ({
  compare: (...args: unknown[]) => mockBcryptCompare(...args),
  hash:    (...args: unknown[]) => mockBcryptHash(...args),
}));

const mockTotpVerify = jest.fn();

jest.mock('speakeasy', () => ({
  totp: {
    verify: (...args: unknown[]) => mockTotpVerify(...args),
  },
}));

const mockIssueAdminToken = jest.fn();

jest.mock('../jwt.service.js', () => ({
  issueAdminToken: (...args: unknown[]) => mockIssueAdminToken(...args),
}));

// ── Fixtures ───────────────────────────────────────────────────────────────

const ADMIN_NO_TOTP = {
  id:           'admin-uuid-1',
  email:        'admin@abroadmatrimony.com',
  name:         'Super Admin',
  passwordHash: '$2b$12$hashedpassword',
  role:         AdminRole.SUPERADMIN,
  isTotpEnabled: false,
  totpSecret:   null,
};

const ADMIN_WITH_TOTP = {
  ...ADMIN_NO_TOTP,
  isTotpEnabled: true,
  totpSecret:   'JBSWY3DPEHPK3PXP',
};

const TOKEN_RESULT = { accessToken: 'admin.jwt.token', expiresIn: 28800 };

// ── Tests ──────────────────────────────────────────────────────────────────

describe('adminLoginService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdate.mockResolvedValue({});
    mockIssueAdminToken.mockReturnValue(TOKEN_RESULT);
    // Dummy hash for timing guard
    mockBcryptHash.mockResolvedValue('$2b$12$dummyhash');
  });

  // ── Happy path — no TOTP ─────────────────────────────────────────────────

  it('returns accessToken + admin data when credentials are valid (no TOTP)', async () => {
    mockFindUnique.mockResolvedValueOnce(ADMIN_NO_TOTP);
    mockBcryptCompare.mockResolvedValueOnce(true);

    const result = await adminLoginService({
      email:    ADMIN_NO_TOTP.email,
      password: 'correct-password',
    });

    expect(result.accessToken).toBe('admin.jwt.token');
    expect(result.expiresIn).toBe(28800);
    expect(result.admin).toEqual({
      id:    ADMIN_NO_TOTP.id,
      email: ADMIN_NO_TOTP.email,
      name:  ADMIN_NO_TOTP.name,
      role:  AdminRole.SUPERADMIN,
    });
  });

  it('calls issueAdminToken with the correct adminId, role, and email', async () => {
    mockFindUnique.mockResolvedValueOnce(ADMIN_NO_TOTP);
    mockBcryptCompare.mockResolvedValueOnce(true);

    await adminLoginService({ email: ADMIN_NO_TOTP.email, password: 'pw' });

    expect(mockIssueAdminToken).toHaveBeenCalledWith(
      ADMIN_NO_TOTP.id,
      AdminRole.SUPERADMIN,
      ADMIN_NO_TOTP.email,
    );
  });

  it('updates lastLoginAt on successful login', async () => {
    mockFindUnique.mockResolvedValueOnce(ADMIN_NO_TOTP);
    mockBcryptCompare.mockResolvedValueOnce(true);

    await adminLoginService({ email: ADMIN_NO_TOTP.email, password: 'pw' });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: ADMIN_NO_TOTP.id },
        data:  expect.objectContaining({ lastLoginAt: expect.any(Date) }),
      }),
    );
  });

  // ── Happy path — with TOTP ───────────────────────────────────────────────

  it('returns token when TOTP is enabled and the code is valid', async () => {
    mockFindUnique.mockResolvedValueOnce(ADMIN_WITH_TOTP);
    mockBcryptCompare.mockResolvedValueOnce(true);
    mockTotpVerify.mockReturnValueOnce(true);

    const result = await adminLoginService({
      email:    ADMIN_WITH_TOTP.email,
      password: 'correct-password',
      totpCode: '123456',
    });

    expect(result.accessToken).toBe('admin.jwt.token');
    expect(mockTotpVerify).toHaveBeenCalledWith(
      expect.objectContaining({
        secret:   ADMIN_WITH_TOTP.totpSecret,
        encoding: 'base32',
        token:    '123456',
      }),
    );
  });

  // ── Wrong credentials ─────────────────────────────────────────────────────

  it('throws AdminCredentialsError when email is not found (bcrypt still runs)', async () => {
    mockFindUnique.mockResolvedValueOnce(null);
    mockBcryptCompare.mockResolvedValueOnce(false); // dummy hash compare

    await expect(
      adminLoginService({ email: 'nobody@example.com', password: 'pw' }),
    ).rejects.toThrow(AdminCredentialsError);

    // Verify bcrypt.compare was called (timing guard active)
    expect(mockBcryptCompare).toHaveBeenCalledTimes(1);
  });

  it('throws AdminCredentialsError when password is wrong', async () => {
    mockFindUnique.mockResolvedValueOnce(ADMIN_NO_TOTP);
    mockBcryptCompare.mockResolvedValueOnce(false);

    await expect(
      adminLoginService({ email: ADMIN_NO_TOTP.email, password: 'wrong' }),
    ).rejects.toThrow(AdminCredentialsError);
  });

  it('does not update lastLoginAt when credentials are wrong', async () => {
    mockFindUnique.mockResolvedValueOnce(ADMIN_NO_TOTP);
    mockBcryptCompare.mockResolvedValueOnce(false);

    await expect(
      adminLoginService({ email: ADMIN_NO_TOTP.email, password: 'wrong' }),
    ).rejects.toThrow(AdminCredentialsError);

    expect(mockUpdate).not.toHaveBeenCalled();
  });

  // ── TOTP errors ───────────────────────────────────────────────────────────

  it('throws AdminTotpRequiredError when TOTP enabled but no code provided', async () => {
    mockFindUnique.mockResolvedValueOnce(ADMIN_WITH_TOTP);
    mockBcryptCompare.mockResolvedValueOnce(true);

    await expect(
      adminLoginService({ email: ADMIN_WITH_TOTP.email, password: 'correct-password' }),
    ).rejects.toThrow(AdminTotpRequiredError);
  });

  it('throws AdminTotpInvalidError when TOTP code is wrong', async () => {
    mockFindUnique.mockResolvedValueOnce(ADMIN_WITH_TOTP);
    mockBcryptCompare.mockResolvedValueOnce(true);
    mockTotpVerify.mockReturnValueOnce(false);

    await expect(
      adminLoginService({
        email:    ADMIN_WITH_TOTP.email,
        password: 'correct-password',
        totpCode: '000000',
      }),
    ).rejects.toThrow(AdminTotpInvalidError);
  });
});
