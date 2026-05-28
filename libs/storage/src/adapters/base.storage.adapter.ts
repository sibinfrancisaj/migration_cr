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
}
