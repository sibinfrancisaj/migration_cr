import { cacheIncrBy, cacheExpire, getRedisClient } from '@abroad-matrimony/cache';
import { CACHE_KEYS } from '@abroad-matrimony/shared';

// 10 attempts per 15-minute window — stricter than OTP (3/hr) because admin
// credentials are high-value and brute-force risk is higher.
const ADMIN_LOGIN_RATE_LIMIT_MAX     = 10;
const ADMIN_LOGIN_RATE_LIMIT_WINDOW  = 15 * 60; // 900 seconds

export interface AdminRateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

/**
 * Increments the admin login attempt counter for `email` and returns whether
 * the request is allowed.  Call this before credential verification so the
 * counter increments on every attempt (not just failed ones).
 */
export async function checkAdminLoginRateLimit(email: string): Promise<AdminRateLimitResult> {
  const key = CACHE_KEYS.ADMIN_LOGIN_ATTEMPTS(email);

  const current = await cacheIncrBy(key, 1);

  // First request in this window — set the TTL so the counter auto-resets.
  if (current === 1) {
    await cacheExpire(key, ADMIN_LOGIN_RATE_LIMIT_WINDOW);
  }

  if (current > ADMIN_LOGIN_RATE_LIMIT_MAX) {
    const ttl = await getRedisClient().ttl(key);
    return {
      allowed: false,
      retryAfterSeconds: ttl > 0 ? ttl : ADMIN_LOGIN_RATE_LIMIT_WINDOW,
    };
  }

  return { allowed: true };
}
