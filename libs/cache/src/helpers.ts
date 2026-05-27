import { getRedisClient } from './client.js';

export async function cacheGet<T>(key: string): Promise<T | null> {
  const raw = await getRedisClient().get(key);
  if (!raw) return null;
  return JSON.parse(raw) as T;
}

export async function cacheSet(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
  const client = getRedisClient();
  const serialized = JSON.stringify(value);
  if (ttlSeconds) {
    await client.set(key, serialized, 'EX', ttlSeconds);
  } else {
    await client.set(key, serialized);
  }
}

export async function cacheDel(key: string): Promise<void> {
  await getRedisClient().del(key);
}

export async function cacheIncrBy(key: string, by = 1): Promise<number> {
  return getRedisClient().incrby(key, by);
}

export async function cacheExpire(key: string, ttlSeconds: number): Promise<void> {
  await getRedisClient().expire(key, ttlSeconds);
}

export async function cacheExists(key: string): Promise<boolean> {
  const result = await getRedisClient().exists(key);
  return result === 1;
}
