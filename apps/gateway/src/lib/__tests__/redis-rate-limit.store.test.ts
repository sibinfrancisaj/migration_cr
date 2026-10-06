import express from 'express';
import request from 'supertest';
import { rateLimit } from 'express-rate-limit';
import { RedisRateLimitStore, GLOBAL_RATE_LIMIT_SCOPE } from '../redis-rate-limit.store.js';

// ── In-memory Redis fake ───────────────────────────────────────────────────────
// Implements just what the store uses; `eval` mirrors the Lua script's semantics.

class FakeRedis {
  data = new Map<string, { value: number; expiresAt: number | null }>();
  evalCalls: unknown[][] = [];
  down = false;

  private live(key: string) {
    const entry = this.data.get(key);
    if (entry && entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.data.delete(key);
      return undefined;
    }
    return entry;
  }

  private check(): void {
    if (this.down) throw new Error('ECONNREFUSED');
  }

  async eval(_script: string, _numKeys: number, key: string, windowMs: string): Promise<[number, number]> {
    this.check();
    this.evalCalls.push([key, windowMs]);
    const entry = this.live(key) ?? { value: 0, expiresAt: null };
    entry.value += 1;
    if (entry.value === 1 || entry.expiresAt === null) entry.expiresAt = Date.now() + Number(windowMs);
    this.data.set(key, entry);
    return [entry.value, entry.expiresAt - Date.now()];
  }

  async get(key: string): Promise<string | null> {
    this.check();
    const entry = this.live(key);
    return entry ? String(entry.value) : null;
  }

  async pttl(key: string): Promise<number> {
    this.check();
    const entry = this.live(key);
    if (!entry) return -2;
    return entry.expiresAt === null ? -1 : entry.expiresAt - Date.now();
  }

  async decr(key: string): Promise<number> {
    this.check();
    const entry = this.live(key);
    if (!entry) return -1;
    entry.value -= 1;
    return entry.value;
  }

  async del(key: string): Promise<number> {
    this.check();
    return this.data.delete(key) ? 1 : 0;
  }
}

function makeStore(fake: FakeRedis, scope?: string): RedisRateLimitStore {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new RedisRateLimitStore(() => fake as any, scope);
}

function makeApp(store: RedisRateLimitStore, max = 2): express.Application {
  const app = express();
  app.use(
    rateLimit({
      windowMs: 60_000,
      max,
      standardHeaders: true,
      legacyHeaders: false,
      store,
      passOnStoreError: true,
      message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
    }),
  );
  app.get('/ping', (_req, res) => {
    res.json({ ok: true });
  });
  return app;
}

// ── Store unit tests ───────────────────────────────────────────────────────────

describe('RedisRateLimitStore', () => {
  let fake: FakeRedis;

  beforeEach(() => {
    fake = new FakeRedis();
  });

  it('is a shared (non-local) store with a namespaced prefix', () => {
    const store = makeStore(fake);
    expect(store.localKeys).toBe(false);
    expect(store.prefix).toBe(`am:rl:${GLOBAL_RATE_LIMIT_SCOPE}:`);
  });

  it('uses a custom scope in the prefix', () => {
    expect(makeStore(fake, 'otp').prefix).toBe('am:rl:otp:');
  });

  it('counts hits per client and passes windowMs from init() to Redis', async () => {
    const store = makeStore(fake);
    store.init({ windowMs: 30_000 } as never);

    expect((await store.increment('1.2.3.4')).totalHits).toBe(1);
    const second = await store.increment('1.2.3.4');

    expect(second.totalHits).toBe(2);
    expect(fake.evalCalls[0]).toEqual([`am:rl:global:1.2.3.4`, '30000']);
    expect(second.resetTime!.getTime()).toBeGreaterThan(Date.now());
    expect(second.resetTime!.getTime()).toBeLessThanOrEqual(Date.now() + 30_000);
  });

  it('keeps clients independent', async () => {
    const store = makeStore(fake);
    await store.increment('a');
    await store.increment('a');
    expect((await store.increment('b')).totalHits).toBe(1);
  });

  it('get() returns undefined for an unknown client', async () => {
    expect(await makeStore(fake).get('nobody')).toBeUndefined();
  });

  it('get() returns hits and reset time for a known client', async () => {
    const store = makeStore(fake);
    await store.increment('a');
    const info = await store.get('a');
    expect(info?.totalHits).toBe(1);
    expect(info?.resetTime).toBeInstanceOf(Date);
  });

  it('decrement() lowers the count', async () => {
    const store = makeStore(fake);
    await store.increment('a');
    await store.increment('a');
    await store.decrement('a');
    expect((await store.get('a'))?.totalHits).toBe(1);
  });

  it('resetKey() clears the client', async () => {
    const store = makeStore(fake);
    await store.increment('a');
    await store.resetKey('a');
    expect(await store.get('a')).toBeUndefined();
  });

  it('propagates Redis errors (express-rate-limit decides whether to fail open)', async () => {
    fake.down = true;
    await expect(makeStore(fake).increment('a')).rejects.toThrow('ECONNREFUSED');
  });

  it('does not touch Redis until first used', () => {
    const getClient = jest.fn();
    new RedisRateLimitStore(getClient);
    expect(getClient).not.toHaveBeenCalled();
  });
});

// ── With express-rate-limit ────────────────────────────────────────────────────

describe('RedisRateLimitStore with express-rate-limit', () => {
  it('allows requests up to the limit, then returns 429 with the RATE_LIMITED body', async () => {
    const app = makeApp(makeStore(new FakeRedis()), 2);

    expect((await request(app).get('/ping')).status).toBe(200);
    expect((await request(app).get('/ping')).status).toBe(200);
    const blocked = await request(app).get('/ping');

    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({ success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } });
  });

  it('sends standard RateLimit headers', async () => {
    const res = await request(makeApp(makeStore(new FakeRedis()), 5)).get('/ping');
    expect(res.headers['ratelimit-limit']).toBe('5');
    expect(res.headers['ratelimit-remaining']).toBe('4');
  });

  it('shares the count across two app instances using the same Redis (scale-out)', async () => {
    const fake = new FakeRedis();
    const instanceA = makeApp(makeStore(fake), 2);
    const instanceB = makeApp(makeStore(fake), 2);

    await request(instanceA).get('/ping');
    await request(instanceB).get('/ping');

    expect((await request(instanceA).get('/ping')).status).toBe(429);
  });

  it('fails open (200) when Redis is down', async () => {
    const fake = new FakeRedis();
    fake.down = true;
    const res = await request(makeApp(makeStore(fake), 1)).get('/ping');
    expect(res.status).toBe(200);
  });

  it('resets once the window expires', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    try {
      const app = makeApp(makeStore(new FakeRedis()), 1);
      expect((await request(app).get('/ping')).status).toBe(200);
      expect((await request(app).get('/ping')).status).toBe(429);

      jest.setSystemTime(Date.now() + 61_000);

      expect((await request(app).get('/ping')).status).toBe(200);
    } finally {
      jest.useRealTimers();
    }
  });
});
