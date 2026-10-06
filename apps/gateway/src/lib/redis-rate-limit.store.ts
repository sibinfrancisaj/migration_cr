import type { ClientRateLimitInfo, Options, Store } from 'express-rate-limit';
import type { getRedisClient } from '@abroad-matrimony/cache';
import { CACHE_KEYS } from '@abroad-matrimony/shared';

type RedisClient = ReturnType<typeof getRedisClient>;

/**
 * INCR + set expiry on first hit, in one round trip. Atomic, so two
 * concurrent first hits can't both miss the PEXPIRE (F-003 TOCTOU window).
 * Returns [hits, ttlMs].
 */
const INCREMENT_SCRIPT = `
local hits = redis.call('INCR', KEYS[1])
if hits == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('PTTL', KEYS[1])
if ttl < 0 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return { hits, ttl }
`;

/** Key namespace inside CACHE_KEYS.RATE_LIMIT for the global gateway limiter. */
export const GLOBAL_RATE_LIMIT_SCOPE = 'global';

/**
 * Redis-backed store for `express-rate-limit` (F-036 / ADR-022).
 *
 * Counters are shared by every gateway instance, so the limit holds when the
 * gateway is scaled out. Fixed window: the first hit starts a `windowMs` TTL.
 * The Redis client is resolved lazily so building the app never opens a
 * connection by itself.
 */
export class RedisRateLimitStore implements Store {
  readonly localKeys = false;
  readonly prefix: string;
  private windowMs = 60_000;

  constructor(
    private readonly getClient: () => RedisClient,
    scope: string = GLOBAL_RATE_LIMIT_SCOPE,
  ) {
    this.prefix = CACHE_KEYS.RATE_LIMIT(`${scope}:`);
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  private key(clientKey: string): string {
    return `${this.prefix}${clientKey}`;
  }

  async get(clientKey: string): Promise<ClientRateLimitInfo | undefined> {
    const client = this.getClient();
    const [hits, ttl] = await Promise.all([client.get(this.key(clientKey)), client.pttl(this.key(clientKey))]);
    if (hits === null) return undefined;
    return { totalHits: Number(hits), resetTime: ttl > 0 ? new Date(Date.now() + ttl) : undefined };
  }

  async increment(clientKey: string): Promise<ClientRateLimitInfo> {
    const [hits, ttl] = (await this.getClient().eval(
      INCREMENT_SCRIPT,
      1,
      this.key(clientKey),
      String(this.windowMs),
    )) as [number, number];
    return { totalHits: Number(hits), resetTime: new Date(Date.now() + Number(ttl)) };
  }

  async decrement(clientKey: string): Promise<void> {
    await this.getClient().decr(this.key(clientKey));
  }

  async resetKey(clientKey: string): Promise<void> {
    await this.getClient().del(this.key(clientKey));
  }
}
