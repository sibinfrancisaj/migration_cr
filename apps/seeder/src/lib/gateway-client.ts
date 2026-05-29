/**
 * HTTP client for calling the gateway API as seeded users.
 * Uses SEEDER_SECRET token format (ADR-014 / SEED-004) to bypass OTP auth.
 */
import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import { seederLog } from './seeder-logger.js';
import { buildSeederToken } from './seeder-token.js';

let _client: AxiosInstance | null = null;

export function getGatewayClient(): AxiosInstance {
  if (_client) return _client;

  const gatewayUrl = process.env['GATEWAY_URL'] ?? 'http://localhost:3000';
  const timeout = 30_000;

  _client = axios.create({
    baseURL: gatewayUrl,
    timeout,
    headers: { 'Content-Type': 'application/json' },
  });

  _client.interceptors.response.use(
    (r) => r,
    (err) => {
      const status = err.response?.status;
      const data = err.response?.data;
      seederLog.warn('Gateway request failed', { status, data, url: err.config?.url });
      return Promise.reject(err);
    },
  );

  return _client;
}

/**
 * Returns request config with Authorization header set to a seeder token
 * that will authenticate as the given userId/role.
 */
export function asUser(
  userId: string,
  role = 'USER',
  deviceId = 'seeder-device',
): AxiosRequestConfig {
  const secret = process.env['SEEDER_SECRET'];
  if (!secret) throw new Error('SEEDER_SECRET not configured');
  const token = buildSeederToken(secret, { userId, role, deviceId });
  return { headers: { Authorization: `Bearer ${token}` } };
}
