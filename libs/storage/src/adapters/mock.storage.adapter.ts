import { createChildLogger } from '@abroad-matrimony/logger';
import type { StorageAdapter } from './base.storage.adapter.js';

const log = createChildLogger({ module: 'storage:mock' });

const MOCK_CDN_BASE = 'https://mock-cdn.example.com';

/**
 * MockStorageAdapter — in-memory no-op for local dev and tests.
 *
 * - upload(): logs and returns a deterministic fake URL
 * - delete(): logs and does nothing
 *
 * Never makes network calls. Safe to use in CI without AWS credentials.
 */
export class MockStorageAdapter implements StorageAdapter {
  async upload(key: string, _buffer: Buffer, mimeType: string): Promise<string> {
    const url = `${MOCK_CDN_BASE}/${key}`;
    log.info('[MOCK STORAGE] File "uploaded"', { key, mimeType, url });
    return url;
  }

  async delete(key: string): Promise<void> {
    log.info('[MOCK STORAGE] File "deleted"', { key });
  }

  getPublicUrl(key: string): string {
    return `${MOCK_CDN_BASE}/${key}`;
  }

  async getPresignedUploadUrl(
    key: string,
    mimeType: string,
    _expiresInSeconds: number,
  ): Promise<{ uploadUrl: string; fileUrl: string }> {
    const uploadUrl = `https://mock-s3.example.com/upload/${key}?presigned=1&mimeType=${encodeURIComponent(mimeType)}`;
    const fileUrl   = `${MOCK_CDN_BASE}/${key}`;
    log.info('[MOCK STORAGE] Presigned upload URL "generated"', { key, mimeType, uploadUrl, fileUrl });
    return { uploadUrl, fileUrl };
  }
}
