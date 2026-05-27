import Redis from 'ioredis';
import { createChildLogger } from '@abroad-matrimony/logger';

const log = createChildLogger({ module: 'cache' });

let _client: Redis | null = null;

export function getRedisClient(): Redis {
  if (_client) return _client;

  const url = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
  _client = new Redis(url, {
    keyPrefix: process.env['REDIS_KEY_PREFIX'] ?? 'am:',
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
  });

  _client.on('connect', () => log.info('Redis connected'));
  _client.on('error', (err) => log.error('Redis error', { err }));
  _client.on('reconnecting', () => log.warn('Redis reconnecting'));

  return _client;
}

export async function closeRedisClient(): Promise<void> {
  if (_client) {
    await _client.quit();
    _client = null;
  }
}
