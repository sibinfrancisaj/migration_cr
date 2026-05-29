/**
 * StorageAdapter — cloud-agnostic interface for file upload/delete.
 *
 * All methods deal with raw `key` values (e.g. "photos/user-uuid/file.jpg").
 * Public URLs are returned by `upload()`; the caller is responsible for
 * persisting them.
 *
 * Implementations:
 *   - S3StorageAdapter   — production (AWS S3 + optional CloudFront)
 *   - MockStorageAdapter — test / local dev (in-memory, no network)
 */
export interface StorageAdapter {
  /**
   * Upload a file buffer to the configured storage bucket.
   * @param key          Storage key (path within the bucket)
   * @param buffer       Raw file bytes
   * @param mimeType     MIME type string (e.g. "image/jpeg")
   * @returns The public URL for the uploaded file
   */
  upload(key: string, buffer: Buffer, mimeType: string): Promise<string>;

  /**
   * Delete a file from the configured storage bucket.
   * @param key  Storage key of the file to remove
   */
  delete(key: string): Promise<void>;

  /**
   * Generate a presigned PUT URL so clients can upload directly to S3.
   *
   * @param key               Storage key (path within the bucket)
   * @param mimeType          Content-Type the client must send with the PUT
   * @param expiresInSeconds  How long the URL remains valid (max 7 days for S3)
   * @returns `uploadUrl`  — presigned S3 PUT URL (share with client)
   *          `fileUrl`    — final public URL of the file once uploaded
   */
  getPresignedUploadUrl(
    key: string,
    mimeType: string,
    expiresInSeconds: number,
  ): Promise<{ uploadUrl: string; fileUrl: string }>;

  /**
   * Derive the public (CDN / S3) URL for an already-uploaded key.
   * Used when the file was uploaded by the client directly via a presigned URL.
   */
  getPublicUrl(key: string): string;
}
