/**
 * PROD-001 — CAN-SPAM compliant email unsubscribe.
 *
 * Tokens are signed compact JWTs (purpose=unsub, 1-year expiry).
 * Verification sets User.emailUnsubscribed = true.
 */
import { createHmac } from 'node:crypto';
import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';
import { getEnv } from '@abroad-matrimony/config';

const log = createChildLogger({ module: 'notification:unsubscribe' });

// ── Error types ───────────────────────────────────────────────────────────────

export class UnsubscribeTokenInvalidError extends Error {
  constructor() {
    super('UNSUBSCRIBE_TOKEN_INVALID');
    this.name = 'UnsubscribeTokenInvalidError';
  }
}

// ── Token helpers ─────────────────────────────────────────────────────────────

const PURPOSE = 'unsub';

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

/**
 * Generates a tamper-proof unsubscribe token for a user.
 * Format: base64url(userId:expires):signature
 */
export function generateUnsubscribeToken(userId: string): string {
  const env = getEnv();
  const expires = Date.now() + 365 * 24 * 60 * 60 * 1000; // 1 year
  const payload = `${PURPOSE}:${userId}:${expires}`;
  const sig = sign(payload, env.JWT_ACCESS_SECRET);
  return `${Buffer.from(payload).toString('base64url')}.${sig}`;
}

/**
 * Verifies an unsubscribe token and marks the user as unsubscribed.
 *
 * @throws {UnsubscribeTokenInvalidError} on tampered / expired token
 */
export async function processUnsubscribe(token: string): Promise<{ userId: string }> {
  const env = getEnv();

  const [payloadB64, sig] = token.split('.');
  if (!payloadB64 || !sig) throw new UnsubscribeTokenInvalidError();

  const payload = Buffer.from(payloadB64, 'base64url').toString('utf-8');
  const expectedSig = sign(payload, env.JWT_ACCESS_SECRET);

  // Constant-time comparison
  if (!timingSafeEqual(sig, expectedSig)) throw new UnsubscribeTokenInvalidError();

  const parts = payload.split(':');
  if (parts.length !== 3 || parts[0] !== PURPOSE) throw new UnsubscribeTokenInvalidError();

  const [, userId, expiresStr] = parts;
  if (Date.now() > Number(expiresStr)) throw new UnsubscribeTokenInvalidError();

  await prisma.user.update({
    where: { id: userId },
    data: { emailUnsubscribed: true },
  });

  log.info('User unsubscribed from emails', { userId });

  return { userId };
}

/**
 * Resubscribes a user to marketing emails (authenticated endpoint).
 */
export async function resubscribeEmail(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { emailUnsubscribed: false },
  });

  log.info('User resubscribed to emails', { userId });
}

// ── Timing-safe string comparison ─────────────────────────────────────────────

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
