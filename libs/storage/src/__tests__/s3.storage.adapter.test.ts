import { S3StorageAdapter } from '../adapters/s3.storage.adapter.js';

// ── AWS SDK mock ──────────────────────────────────────────────────────────────

const mockS3Send = jest.fn();

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client:            jest.fn().mockImplementation(() => ({ send: mockS3Send })),
  PutObjectCommand:    jest.fn().mockImplementation((input) => ({ _type: 'PutObject',    input })),
  DeleteObjectCommand: jest.fn().mockImplementation((input) => ({ _type: 'DeleteObject', input })),
}));

jest.mock('@abroad-matrimony/logger', () => ({
  createChildLogger: () => ({
    info:  jest.fn(),
    warn:  jest.fn(),
    error: jest.fn(),
  }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeAdapter(cloudFrontDomain?: string): S3StorageAdapter {
  return new S3StorageAdapter(
    'ap-south-1',
    'FAKE_ACCESS_KEY',
    'FAKE_SECRET',
    'test-bucket',
    cloudFrontDomain,
  );
}

const FAKE_BUFFER = Buffer.from('fake-image-data');

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('S3StorageAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockS3Send.mockResolvedValue({});
  });

  // ── upload() ─────────────────────────────────────────────────────────────────

  describe('upload()', () => {
    it('returns a CloudFront URL when cloudFrontDomain is configured', async () => {
      const adapter = makeAdapter('d1234.cloudfront.net');
      const url = await adapter.upload('photos/u/f.jpg', FAKE_BUFFER, 'image/jpeg');

      expect(url).toBe('https://d1234.cloudfront.net/photos/u/f.jpg');
    });

    it('returns an S3 path-style URL when no CloudFront domain is configured', async () => {
      const adapter = makeAdapter();
      const url = await adapter.upload('photos/u/f.jpg', FAKE_BUFFER, 'image/jpeg');

      expect(url).toBe('https://test-bucket.s3.ap-south-1.amazonaws.com/photos/u/f.jpg');
    });

    it('calls S3Client.send with PutObjectCommand containing the correct params', async () => {
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');
      const adapter = makeAdapter();

      await adapter.upload('photos/u/f.jpg', FAKE_BUFFER, 'image/jpeg');

      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket:      'test-bucket',
        Key:         'photos/u/f.jpg',
        Body:        FAKE_BUFFER,
        ContentType: 'image/jpeg',
      });
      expect(mockS3Send).toHaveBeenCalledTimes(1);
    });

    it('propagates errors thrown by S3Client.send', async () => {
      mockS3Send.mockRejectedValueOnce(new Error('S3 unreachable'));
      const adapter = makeAdapter();

      await expect(
        adapter.upload('photos/u/f.jpg', FAKE_BUFFER, 'image/jpeg'),
      ).rejects.toThrow('S3 unreachable');
    });

    it('builds the URL with the exact key as the path component', async () => {
      const adapter = makeAdapter('cdn.example.com');
      const key = 'photos/user-abc/uuid-123.png';
      const url = await adapter.upload(key, FAKE_BUFFER, 'image/png');

      expect(url).toBe(`https://cdn.example.com/${key}`);
    });
  });

  // ── delete() ─────────────────────────────────────────────────────────────────

  describe('delete()', () => {
    it('calls S3Client.send with DeleteObjectCommand containing the correct params', async () => {
      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
      const adapter = makeAdapter();

      await adapter.delete('photos/u/f.jpg');

      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key:    'photos/u/f.jpg',
      });
      expect(mockS3Send).toHaveBeenCalledTimes(1);
    });

    it('resolves without returning a value on success', async () => {
      const adapter = makeAdapter();
      await expect(adapter.delete('photos/u/f.jpg')).resolves.toBeUndefined();
    });

    it('propagates errors thrown by S3Client.send', async () => {
      mockS3Send.mockRejectedValueOnce(new Error('S3 delete failed'));
      const adapter = makeAdapter();

      await expect(adapter.delete('photos/u/f.jpg')).rejects.toThrow('S3 delete failed');
    });
  });
});
