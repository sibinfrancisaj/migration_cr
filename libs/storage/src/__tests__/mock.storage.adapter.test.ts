import { MockStorageAdapter } from '../adapters/mock.storage.adapter.js';

jest.mock('@abroad-matrimony/logger', () => ({
  createChildLogger: () => ({
    info:  jest.fn(),
    warn:  jest.fn(),
    error: jest.fn(),
  }),
}));

describe('MockStorageAdapter', () => {
  let adapter: MockStorageAdapter;

  beforeEach(() => {
    adapter = new MockStorageAdapter();
  });

  // ── upload() ─────────────────────────────────────────────────────────────────

  describe('upload()', () => {
    it('returns a mock CDN URL containing the given key', async () => {
      const url = await adapter.upload(
        'photos/user-1/abc.jpg',
        Buffer.from('fake'),
        'image/jpeg',
      );

      expect(url).toBe('https://mock-cdn.example.com/photos/user-1/abc.jpg');
    });

    it('embeds the key verbatim in the returned URL', async () => {
      const key = 'photos/user-xyz/some-uuid.png';
      const url = await adapter.upload(key, Buffer.from('data'), 'image/png');

      expect(url).toContain(key);
    });

    it('resolves without throwing for any valid MIME type', async () => {
      await expect(
        adapter.upload('photos/u/f.webp', Buffer.from(''), 'image/webp'),
      ).resolves.toBeDefined();
    });

    it('resolves with an empty buffer (zero-byte file)', async () => {
      const url = await adapter.upload('photos/u/empty.jpg', Buffer.alloc(0), 'image/jpeg');
      expect(typeof url).toBe('string');
    });
  });

  // ── delete() ─────────────────────────────────────────────────────────────────

  describe('delete()', () => {
    it('resolves without throwing', async () => {
      await expect(adapter.delete('photos/user-1/abc.jpg')).resolves.toBeUndefined();
    });

    it('resolves for any key, including keys that do not exist', async () => {
      await expect(adapter.delete('photos/nonexistent/file.jpg')).resolves.toBeUndefined();
    });
  });
});
