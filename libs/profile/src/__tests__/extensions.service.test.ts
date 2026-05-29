import {
  toggleProfilePause,
  getVoiceIntroUploadUrl,
  saveVoiceIntro,
} from '../extensions.service.js';
import { ProfileNotFoundError } from '../real-life-answer.service.js';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockProfileFindUnique  = jest.fn();
const mockProfileUpdate      = jest.fn();
const mockMediaDeleteMany    = jest.fn();
const mockMediaCreate        = jest.fn();
const mockGetStorageAdapter  = jest.fn();

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    profile: {
      findUnique: (...a: unknown[]) => mockProfileFindUnique(...a),
      update:     (...a: unknown[]) => mockProfileUpdate(...a),
    },
    media: {
      deleteMany: (...a: unknown[]) => mockMediaDeleteMany(...a),
      create:     (...a: unknown[]) => mockMediaCreate(...a),
    },
  },
}));

jest.mock('@abroad-matrimony/storage', () => ({
  getStorageAdapter: (...a: unknown[]) => mockGetStorageAdapter(...a),
}));

// ── Fixtures ───────────────────────────────────────────────────────────────────

const USER_ID = 'user-uuid-1';

// ── toggleProfilePause ─────────────────────────────────────────────────────────

describe('toggleProfilePause', () => {
  beforeEach(() => jest.clearAllMocks());

  it('toggles isPaused from false to true', async () => {
    mockProfileFindUnique.mockResolvedValue({ id: 'profile-1', isPaused: false });
    mockProfileUpdate.mockResolvedValue({ isPaused: true });

    const result = await toggleProfilePause(USER_ID);

    expect(mockProfileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_ID },
        data: { isPaused: true },
      }),
    );
    expect(result.isPaused).toBe(true);
  });

  it('toggles isPaused from true to false', async () => {
    mockProfileFindUnique.mockResolvedValue({ id: 'profile-1', isPaused: true });
    mockProfileUpdate.mockResolvedValue({ isPaused: false });

    const result = await toggleProfilePause(USER_ID);

    expect(mockProfileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isPaused: false } }),
    );
    expect(result.isPaused).toBe(false);
  });

  it('throws ProfileNotFoundError when profile does not exist', async () => {
    mockProfileFindUnique.mockResolvedValue(null);

    await expect(toggleProfilePause(USER_ID)).rejects.toBeInstanceOf(ProfileNotFoundError);
    expect(mockProfileUpdate).not.toHaveBeenCalled();
  });
});

// ── getVoiceIntroUploadUrl ─────────────────────────────────────────────────────

describe('getVoiceIntroUploadUrl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetStorageAdapter.mockReturnValue({
      getPresignedUploadUrl: jest.fn().mockResolvedValue({
        uploadUrl: 'https://s3.example.com/presigned',
        fileUrl: 'https://cdn.example.com/file.mp3',
      }),
    });
  });

  it('returns a presigned URL for mp3', async () => {
    mockProfileFindUnique.mockResolvedValue({ id: 'profile-1' });

    const result = await getVoiceIntroUploadUrl(USER_ID, 'audio/mpeg');

    expect(result.uploadUrl).toBe('https://s3.example.com/presigned');
    expect(result.s3Key).toMatch(/^voice-intros\/user-uuid-1\//);
    expect(result.s3Key).toMatch(/\.mp3$/);
  });

  it('returns a presigned URL for webm', async () => {
    mockProfileFindUnique.mockResolvedValue({ id: 'profile-1' });

    const result = await getVoiceIntroUploadUrl(USER_ID, 'audio/webm');
    expect(result.s3Key).toMatch(/\.webm$/);
  });

  it('uses aac as default extension for unknown mime type', async () => {
    mockProfileFindUnique.mockResolvedValue({ id: 'profile-1' });

    const result = await getVoiceIntroUploadUrl(USER_ID, 'audio/aac');
    expect(result.s3Key).toMatch(/\.aac$/);
  });

  it('throws ProfileNotFoundError when profile does not exist', async () => {
    mockProfileFindUnique.mockResolvedValue(null);

    await expect(getVoiceIntroUploadUrl(USER_ID, 'audio/mpeg')).rejects.toBeInstanceOf(
      ProfileNotFoundError,
    );
  });
});

// ── saveVoiceIntro ─────────────────────────────────────────────────────────────

describe('saveVoiceIntro', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetStorageAdapter.mockReturnValue({
      getPublicUrl: (key: string) => `https://cdn.example.com/${key}`,
    });
  });

  it('deletes existing voice intro and creates a new media record', async () => {
    mockProfileFindUnique.mockResolvedValue({ id: 'profile-1' });
    mockMediaDeleteMany.mockResolvedValue({ count: 1 });
    mockMediaCreate.mockResolvedValue({});

    const s3Key = 'voice-intros/user-uuid-1/1234567890.mp3';
    const result = await saveVoiceIntro(USER_ID, s3Key);

    expect(mockMediaDeleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_ID, type: 'VOICE_INTRO' },
      }),
    );
    expect(mockMediaCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: USER_ID,
          s3Key,
          type: 'VOICE_INTRO',
        }),
      }),
    );
    expect(result.url).toBe(`https://cdn.example.com/${s3Key}`);
  });

  it('throws ProfileNotFoundError when profile does not exist', async () => {
    mockProfileFindUnique.mockResolvedValue(null);

    await expect(saveVoiceIntro(USER_ID, 'voice-intros/user/123.mp3')).rejects.toBeInstanceOf(
      ProfileNotFoundError,
    );
    expect(mockMediaDeleteMany).not.toHaveBeenCalled();
  });
});
