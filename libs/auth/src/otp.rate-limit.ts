import { cacheIncrBy, cacheExpire, getRedisClient } from '@abroad-matrimony/cache';
import { getEnv } from '@abroad-matrimony/config';
import { CACHE_KEYS } from '@abroad-matrimony/shared';

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

export async function checkAndIncrOtpRateLimit(phone: string): Promise<RateLimitResult> {
  const env = getEnv();
  const key = CACHE_KEYS.OTP_ATTEMPTS(phone);
  const windowSeconds = Math.ceil(env.OTP_RATE_LIMIT_WINDOW_MS / 1000);

  const current = await cacheIncrBy(key, 1);

  // First request in this window — set the expiry so the counter auto-resets
  if (current === 1) {
    await cacheExpire(key, windowSeconds);
  }

  if (current > env.OTP_RATE_LIMIT_MAX) {
    const ttl = await getRedisClient().ttl(key);
    return { allowed: false, retryAfterSeconds: ttl > 0 ? ttl : windowSeconds };
  }

  return { allowed: true };
}
