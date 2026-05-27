import bcrypt from 'bcrypt';
import speakeasy from 'speakeasy';
import { prisma } from '@abroad-matrimony/db';
import { AdminRole } from '@abroad-matrimony/shared';
import { issueAdminToken } from './jwt.service.js';
import type { AdminTokenResult } from './jwt.service.js';

// ── Custom errors ─────────────────────────────────────────────────────────────

/** Wrong email or wrong password.  Single error prevents admin email enumeration. */
export class AdminCredentialsError extends Error {
  constructor() {
    super('ADMIN_INVALID_CREDENTIALS');
    this.name = 'AdminCredentialsError';
  }
}

/** TOTP is enabled for this admin but no code was supplied in the request. */
export class AdminTotpRequiredError extends Error {
  constructor() {
    super('ADMIN_TOTP_REQUIRED');
    this.name = 'AdminTotpRequiredError';
  }
}

/** TOTP is enabled and a code was supplied but it did not validate. */
export class AdminTotpInvalidError extends Error {
  constructor() {
    super('ADMIN_TOTP_INVALID');
    this.name = 'AdminTotpInvalidError';
  }
}

// ── Timing-safe dummy hash ────────────────────────────────────────────────────
// Lazily computed with the same cost factor used for real admin passwords (12).
// When the requested admin email is not found we still run bcrypt.compare
// against this dummy hash so the response time is indistinguishable from a
// legitimate-but-wrong-password attempt.
let _dummyHash: string | null = null;

async function getDummyHash(): Promise<string> {
  if (!_dummyHash) {
    _dummyHash = await bcrypt.hash('__timing_guard__', 12);
  }
  return _dummyHash;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AdminLoginInput {
  email: string;
  password: string;
  totpCode?: string;
}

export interface AdminLoginResult extends AdminTokenResult {
  admin: {
    id: string;
    email: string;
    name: string;
    role: AdminRole;
  };
}

// ── Service ───────────────────────────────────────────────────────────────────

/**
 * Authenticates an admin user.
 *
 * Flow:
 *   1. Fetch admin row by email (or use dummy hash if not found).
 *   2. Run bcrypt.compare — always, to prevent timing-based enumeration.
 *   3. Check TOTP if enabled.
 *   4. Update lastLoginAt.
 *   5. Issue admin JWT and return.
 *
 * @throws {AdminCredentialsError} on unknown email or wrong password
 * @throws {AdminTotpRequiredError} when TOTP enabled but totpCode not provided
 * @throws {AdminTotpInvalidError} when TOTP enabled but totpCode is wrong
 */
export async function adminLoginService(input: AdminLoginInput): Promise<AdminLoginResult> {
  const { email, password, totpCode } = input;

  // 1. Fetch admin — continue even if not found (timing guard).
  const admin = await prisma.adminUser.findUnique({ where: { email } });

  // 2. Always run bcrypt.compare to prevent timing-based email enumeration.
  const hashToCompare = admin?.passwordHash ?? (await getDummyHash());
  const passwordValid = await bcrypt.compare(password, hashToCompare);

  if (!admin || !passwordValid) {
    throw new AdminCredentialsError();
  }

  // 3. TOTP check (only reached when password is valid).
  if (admin.isTotpEnabled) {
    if (!totpCode) {
      throw new AdminTotpRequiredError();
    }

    const totpValid = speakeasy.totp.verify({
      secret: admin.totpSecret!,
      encoding: 'base32',
      token: totpCode,
      window: 1, // allow ±1 period (±30s) tolerance for clock skew
    });

    if (!totpValid) {
      throw new AdminTotpInvalidError();
    }
  }

  // 4. Update last login timestamp (best-effort — don't block the response).
  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date() },
  });

  // 5. Issue admin JWT.
  const { accessToken, expiresIn } = issueAdminToken(admin.id, admin.role as AdminRole, admin.email);

  return {
    accessToken,
    expiresIn,
    admin: {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role as AdminRole,
    },
  };
}
