/**
 * Seeder-specific env var helpers.
 * Avoids importing the full gateway getEnv() which requires DB/JWT vars.
 */

export interface SeederEnv {
  NODE_ENV: string;
  SEEDER_PORT: number;
  GATEWAY_URL: string;
  SEEDER_SECRET: string;
  SEEDER_PHOTO_S3_PREFIX: string;
  SEEDER_INITIAL_COUNT: number;
  SEEDER_DRIP_MIN: number;
  SEEDER_DRIP_MAX: number;
  SEEDER_DRIP_INTERVAL_HOURS: number;
  REDIS_URL: string;
}

let _seederEnv: SeederEnv | null = null;

export function getSeederEnv(): SeederEnv {
  if (_seederEnv) return _seederEnv;

  const secret = process.env['SEEDER_SECRET'];
  if (!secret) throw new Error('SEEDER_SECRET is required for the seeder app');

  _seederEnv = {
    NODE_ENV: process.env['NODE_ENV'] ?? 'development',
    SEEDER_PORT: Number(process.env['SEEDER_PORT'] ?? 3100),
    GATEWAY_URL: process.env['GATEWAY_URL'] ?? 'http://localhost:3000',
    SEEDER_SECRET: secret,
    SEEDER_PHOTO_S3_PREFIX: process.env['SEEDER_PHOTO_S3_PREFIX'] ?? 'seeder/profile-photos',
    SEEDER_INITIAL_COUNT: Number(process.env['SEEDER_INITIAL_COUNT'] ?? 500),
    SEEDER_DRIP_MIN: Number(process.env['SEEDER_DRIP_MIN'] ?? 3),
    SEEDER_DRIP_MAX: Number(process.env['SEEDER_DRIP_MAX'] ?? 5),
    SEEDER_DRIP_INTERVAL_HOURS: Number(process.env['SEEDER_DRIP_INTERVAL_HOURS'] ?? 3),
    REDIS_URL: process.env['REDIS_URL'] ?? 'redis://localhost:6379',
  };

  return _seederEnv;
}

export function resetSeederEnvCache(): void {
  _seederEnv = null;
}
