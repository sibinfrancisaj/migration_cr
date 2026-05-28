import { getEnv } from '@abroad-matrimony/config';
import type { StorageAdapter } from './base.storage.adapter.js';
import { S3StorageAdapter } from './s3.storage.adapter.js';
import { MockStorageAdapter } from './mock.storage.adapter.js';

export type { StorageAdapter } from './base.storage.adapter.js';
export { S3StorageAdapter } from './s3.storage.adapter.js';
export { MockStorageAdapter } from './mock.storage.adapter.js';

/**
 * Factory — returns the appropriate StorageAdapter based on available env vars.
 *
 * S3 adapter is used when all three required AWS credentials are present:
 *   - AWS_ACCESS_KEY_ID
 *   - AWS_SECRET_ACCESS_KEY
 *   - AWS_S3_BUCKET
 *
 * Falls back to MockStorageAdapter for local dev (no credentials) and test
 * environments (mocked at the module level in tests).
 */
export function getStorageAdapter(): StorageAdapter {
  const env = getEnv();
  if (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY && env.AWS_S3_BUCKET) {
    return new S3StorageAdapter(
      env.AWS_REGION,
      env.AWS_ACCESS_KEY_ID,
      env.AWS_SECRET_ACCESS_KEY,
      env.AWS_S3_BUCKET,
      env.AWS_CLOUDFRONT_DOMAIN,
    );
  }
  return new MockStorageAdapter();
}
