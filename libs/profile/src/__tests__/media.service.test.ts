import { uploadProfilePhoto, PhotoLimitExceededError, InvalidMimeTypeError, MAX_PHOTOS_PER_USER } from '../media.service.js';
import { ProfileNotFoundError } from '../real-life-answer.service.js';
import { MediaType } from '@abroad-matrimony/shared';

// ── DB mock ───────────────────────────────────────────────────────────────────

const mockProfileFindUnique = jest.fn();
const mockMediaCount        = jest.fn();
const mockMediaCreate       = jest.fn();

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    profile: {
      findUnique: (...args: unknown[]) => mockProfileFindUnique(...args),
    },
    media: {
      count:  (...args: unknown[]) => mockMediaCount(...args),
      create: (...args: unknown[]) => mockMediaCreate(...args),
    },
  },
  PrismaClient: jest.fn(),
  Prisma: {},
}));

// ── Storage mock ──────────────────────────────────────────────────────────────

const mockUpload = jest.fn();

jest.mock('@abroad-matrimony/storage', () => ({
  getStorageAdapter: () => ({
    upload: (...args: unknown[]) => mockUpload(...args),
    delete: jest.fn(),
  }),
}));

// ── Score service mock ────────────────────────────────────────────────────────

jest.mock('../score.service.js', () => ({
  recalculateCompletionScore: jest.fn().mockResolvedValue(30),
}));

// ── Logger mock ───────────────────────────────────────────────────────────────

jest.mock('@abroad-matrimony/logger', () => ({
  createChildLogger: () => ({
    info:  jest.fn(),
    warn:  jest.fn(),
    error: jest.fn(),
  }),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DB_PROFILE = {
  id:     'profile-uuid-1',
  userId: 'user-uuid-1',
};

const DB_MEDIA_ROW = {
  id:         'media-uuid-1',
  userId:     'user-uuid-1',
  type:       MediaType.PHOTO,
  s3Key:      'photos/user-uuid-1/some-uuid.jpg',
  url:        'https://mock-cdn.example.com/photos/user-uuid-1/some-uuid.jpg',
  order:      1,
  isVerified: false,
  createdAt:  new Date('2026-05-27T10:00:00.000Z'),
};

const BASE_INPUT = {
  userId:   'user-uuid-1',
  buffer:   Buffer.from('fake-image'),
  mimeType: 'image/jpeg',
  filename: 'photo.jpg',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('uploadProfilePhoto()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProfileFindUnique.mockResolvedValue(DB_PROFILE);
    mockMediaCount.mockResolvedValue(0);              // 0 existing photos
    mockUpload.mockResolvedValue(DB_MEDIA_ROW.url);
    mockMediaCreate.mockResolvedValue(DB_MEDIA_ROW);
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it('returns a MediaDto on success', async () => {
    const result = await uploadProfilePhoto(BASE_INPUT);

    expect(result.id).toBe('media-uuid-1');
    expect(result.type).toBe(MediaType.PHOTO);
    expect(result.url).toBe(DB_MEDIA_ROW.url);
    expect(result.order).toBe(1);
    expect(result.isVerified).toBe(false);
    expect(result.createdAt).toBeInstanceOf(Date);
  });

  it('sets order = existing photo count + 1', async () => {
    mockMediaCount.mockResolvedValue(3); // 3 existing photos
    const rowWith4 = { ...DB_MEDIA_ROW, order: 4 };
    mockMediaCreate.mockResolvedValue(rowWith4);

    const result = await uploadProfilePhoto(BASE_INPUT);

    expect(mockMediaCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ order: 4 }) }),
    );
    expect(result.order).toBe(4);
  });

  it('calls storageAdapter.upload with the correct key pattern, buffer, and MIME type', async () => {
    await uploadProfilePhoto(BASE_INPUT);

    const [key, buffer, mimeType] = mockUpload.mock.calls[0];
    expect(key).toMatch(/^photos\/user-uuid-1\/.+\.jpg$/);
    expect(buffer).toEqual(BASE_INPUT.buffer);
    expect(mimeType).toBe('image/jpeg');
  });

  it('generates a unique S3 key for each upload (UUID-based)', async () => {
    mockMediaCreate.mockResolvedValue({ ...DB_MEDIA_ROW, id: 'media-uuid-2' });
    await uploadProfilePhoto(BASE_INPUT);
    const key1 = mockUpload.mock.calls[0][0] as string;

    jest.clearAllMocks();
    mockProfileFindUnique.mockResolvedValue(DB_PROFILE);
    mockMediaCount.mockResolvedValue(1);
    mockUpload.mockResolvedValue('https://mock-cdn.example.com/photos/user-uuid-1/other-uuid.jpg');
    mockMediaCreate.mockResolvedValue({ ...DB_MEDIA_ROW, id: 'media-uuid-3', order: 2 });
    await uploadProfilePhoto(BASE_INPUT);
    const key2 = mockUpload.mock.calls[0][0] as string;

    expect(key1).not.toBe(key2);
  });

  it('preserves the file extension from the original filename', async () => {
    await uploadProfilePhoto({ ...BASE_INPUT, filename: 'portrait.png', mimeType: 'image/png' });

    const [key] = mockUpload.mock.calls[0];
    expect(key).toMatch(/\.png$/);
  });

  it('uses .jpg extension when filename has no extension', async () => {
    await uploadProfilePhoto({ ...BASE_INPUT, filename: 'noextension', mimeType: 'image/jpeg' });

    const [key] = mockUpload.mock.calls[0];
    expect(key).toMatch(/\.jpg$/);
  });

  it('stores the URL returned by the storage adapter in the DB', async () => {
    const fakeUrl = 'https://cdn.example.com/photos/user-uuid-1/uuid.jpg';
    mockUpload.mockResolvedValue(fakeUrl);

    await uploadProfilePhoto(BASE_INPUT);

    expect(mockMediaCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ url: fakeUrl }) }),
    );
  });

  it('persists isVerified=false on the new media row', async () => {
    await uploadProfilePhoto(BASE_INPUT);

    expect(mockMediaCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isVerified: false }) }),
    );
  });

  it('calls recalculateCompletionScore after a successful upload', async () => {
    const { recalculateCompletionScore } = await import('../score.service.js');
    await uploadProfilePhoto(BASE_INPUT);

    expect(recalculateCompletionScore).toHaveBeenCalledWith('user-uuid-1');
  });

  it('accepts image/png MIME type', async () => {
    await expect(
      uploadProfilePhoto({ ...BASE_INPUT, mimeType: 'image/png', filename: 'f.png' }),
    ).resolves.toBeDefined();
  });

  it('accepts image/webp MIME type', async () => {
    await expect(
      uploadProfilePhoto({ ...BASE_INPUT, mimeType: 'image/webp', filename: 'f.webp' }),
    ).resolves.toBeDefined();
  });

  // ── ProfileNotFoundError ──────────────────────────────────────────────────

  it('throws ProfileNotFoundError when the user has no profile', async () => {
    mockProfileFindUnique.mockResolvedValue(null);

    await expect(uploadProfilePhoto(BASE_INPUT)).rejects.toThrow(ProfileNotFoundError);
  });

  it('does not upload or create a DB row when profile is not found', async () => {
    mockProfileFindUnique.mockResolvedValue(null);

    await expect(uploadProfilePhoto(BASE_INPUT)).rejects.toThrow();

    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockMediaCreate).not.toHaveBeenCalled();
  });

  // ── PhotoLimitExceededError ───────────────────────────────────────────────

  it(`throws PhotoLimitExceededError when user already has ${MAX_PHOTOS_PER_USER} photos`, async () => {
    mockMediaCount.mockResolvedValue(MAX_PHOTOS_PER_USER);

    await expect(uploadProfilePhoto(BASE_INPUT)).rejects.toThrow(PhotoLimitExceededError);
  });

  it('does not upload when the photo limit is reached', async () => {
    mockMediaCount.mockResolvedValue(MAX_PHOTOS_PER_USER);

    await expect(uploadProfilePhoto(BASE_INPUT)).rejects.toThrow();
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('allows upload when count is exactly one below the limit', async () => {
    mockMediaCount.mockResolvedValue(MAX_PHOTOS_PER_USER - 1);
    const lastRow = { ...DB_MEDIA_ROW, order: MAX_PHOTOS_PER_USER };
    mockMediaCreate.mockResolvedValue(lastRow);

    await expect(uploadProfilePhoto(BASE_INPUT)).resolves.toBeDefined();
  });

  // ── InvalidMimeTypeError ──────────────────────────────────────────────────

  it('throws InvalidMimeTypeError for an unsupported MIME type', async () => {
    await expect(
      uploadProfilePhoto({ ...BASE_INPUT, mimeType: 'image/gif' }),
    ).rejects.toThrow(InvalidMimeTypeError);
  });

  it('throws InvalidMimeTypeError for application/pdf', async () => {
    await expect(
      uploadProfilePhoto({ ...BASE_INPUT, mimeType: 'application/pdf' }),
    ).rejects.toThrow(InvalidMimeTypeError);
  });

  it('does not upload when MIME type is invalid', async () => {
    await expect(
      uploadProfilePhoto({ ...BASE_INPUT, mimeType: 'image/bmp' }),
    ).rejects.toThrow();

    expect(mockUpload).not.toHaveBeenCalled();
  });

  // ── Error propagation ─────────────────────────────────────────────────────

  it('re-throws unexpected errors from storageAdapter.upload', async () => {
    mockUpload.mockRejectedValueOnce(new Error('S3 timeout'));

    await expect(uploadProfilePhoto(BASE_INPUT)).rejects.toThrow('S3 timeout');
  });

  it('re-throws unexpected errors from prisma.media.create', async () => {
    mockMediaCreate.mockRejectedValueOnce(new Error('DB write failed'));

    await expect(uploadProfilePhoto(BASE_INPUT)).rejects.toThrow('DB write failed');
  });

  it('re-throws unexpected errors from the initial Promise.all', async () => {
    mockProfileFindUnique.mockRejectedValueOnce(new Error('DB connection lost'));

    await expect(uploadProfilePhoto(BASE_INPUT)).rejects.toThrow('DB connection lost');
  });
});
