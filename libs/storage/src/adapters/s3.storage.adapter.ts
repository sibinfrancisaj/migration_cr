import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createChildLogger } from '@abroad-matrimony/logger';
import type { StorageAdapter } from './base.storage.adapter.js';

const log = createChildLogger({ module: 'storage:s3' });

/**
 * S3StorageAdapter — uploads and deletes objects in a single AWS S3 bucket.
 *
 * Files are stored with private ACL (bucket is not publicly accessible).
 * Public URLs are served via CloudFront if a domain is configured, otherwise
 * via the S3 path-style URL (useful for private buckets behind a CDN).
 *
 * ADR note: The bucket is kept private; CloudFront handles public delivery.
 * See architecture.md Section 3 for the full media storage design.
 */
export class S3StorageAdapter implements StorageAdapter {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly baseUrl: string;

  constructor(
    region: string,
    accessKeyId: string,
    secretAccessKey: string,
    bucket: string,
    cloudFrontDomain?: string,
  ) {
    this.client = new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey },
    });
    this.bucket  = bucket;
    this.baseUrl = cloudFrontDomain
      ? `https://${cloudFrontDomain}`
      : `https://${bucket}.s3.${region}.amazonaws.com`;
  }

  async upload(key: string, buffer: Buffer, mimeType: string): Promise<string> {
    const command = new PutObjectCommand({
      Bucket:      this.bucket,
      Key:         key,
      Body:        buffer,
      ContentType: mimeType,
    });

    await this.client.send(command);
    const url = `${this.baseUrl}/${key}`;
    log.info('File uploaded to S3', { key, mimeType, bucket: this.bucket });
    return url;
  }

  async delete(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key:    key,
    });

    await this.client.send(command);
    log.info('File deleted from S3', { key, bucket: this.bucket });
  }

  getPublicUrl(key: string): string {
    return `${this.baseUrl}/${key}`;
  }

  async getPresignedUploadUrl(
    key: string,
    mimeType: string,
    expiresInSeconds: number,
  ): Promise<{ uploadUrl: string; fileUrl: string }> {
    const command = new PutObjectCommand({
      Bucket:      this.bucket,
      Key:         key,
      ContentType: mimeType,
    });

    const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
    const fileUrl   = `${this.baseUrl}/${key}`;

    log.info('Presigned upload URL generated', { key, mimeType, bucket: this.bucket, expiresInSeconds });
    return { uploadUrl, fileUrl };
  }
}
