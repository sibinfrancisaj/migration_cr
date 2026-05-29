import {
  submitVerification,
  getVerificationStatus,
  getTrustScore,
  getVerificationUploadUrl,
  VerificationAlreadySubmittedError,
  VerificationNotFoundError,
  TRUST_LAYERS,
} from '../index.js';
import { VerificationStatus, MediaType } from '@abroad-matrimony/shared';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockVerificationFindFirst = jest.fn();
const mockVerificationCreate    = jest.fn();
const mockMediaCreateMany       = jest.fn();
const mockUserFindUnique        = jest.fn();
const mockMediaFindFirst        = jest.fn();
const mockGetStorageAdapter     = jest.fn();

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    verificationRequest: {
      findFirst:  (...a: unknown[]) => mockVerificationFindFirst(...a),
      create:     (...a: unknown[]) => mockVerificationCreate(...a),
    },
    media: {
      createMany: (...a: unknown[]) => mockMediaCreateMany(...a),
      findFirst:  (...a: unknown[]) => mockMediaFindFirst(...a),
    },
    user: {
      findUnique: (...a: unknown[]) => mockUserFindUnique(...a),
    },
  },
}));

jest.mock('@abroad-matrimony/storage', () => ({
  getStorageAdapter: (...a: unknown[]) => mockGetStorageAdapter(...a),
}));

// ── Fixtures ───────────────────────────────────────────────────────────────────

const USER_ID = 'user-uuid-1';

const VERIFICATION_ROW = {
  id: 'ver-uuid-1',
  userId: USER_ID,
  status: VerificationStatus.PENDING,
  idDocType: 'PASSPORT',
  idDocS3Key: 'verification/user-uuid-1/id-doc.jpg',
  selfieS3Key: 'verification/user-uuid-1/selfie.jpg',
  submittedAt: new Date('2026-05-01T10:00:00Z'),
  reviewedAt: null,
  reviewNote: null,
};

// ── submitVerification ─────────────────────────────────────────────────────────

describe('submitVerification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetStorageAdapter.mockReturnValue({
      getPublicUrl: (key: string) => `https://cdn.example.com/${key}`,
    });
  });

  it('creates a verification request and saves media records', async () => {
    mockVerificationFindFirst.mockResolvedValue(null);
    mockVerificationCreate.mockResolvedValue(VERIFICATION_ROW);
    mockMediaCreateMany.mockResolvedValue({});

    const result = await submitVerification(
      USER_ID,
      'PASSPORT',
      'verification/user/id.jpg',
      'verification/user/selfie.jpg',
    );

    expect(mockVerificationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: USER_ID,
          idDocType: 'PASSPORT',
          status: VerificationStatus.PENDING,
        }),
      }),
    );
    expect(mockMediaCreateMany).toHaveBeenCalled();
    expect(result.status).toBe(VerificationStatus.PENDING);
    expect(result.idDocType).toBe('PASSPORT');
    expect(result.reviewedAt).toBeNull();
  });

  it('throws VerificationAlreadySubmittedError when a pending request exists', async () => {
    mockVerificationFindFirst.mockResolvedValue({ id: 'existing-ver' });

    await expect(
      submitVerification(USER_ID, 'PASSPORT', 'id.jpg', 'selfie.jpg'),
    ).rejects.toBeInstanceOf(VerificationAlreadySubmittedError);

    expect(mockVerificationCreate).not.toHaveBeenCalled();
  });
});

// ── getVerificationStatus ──────────────────────────────────────────────────────

describe('getVerificationStatus', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns null when no verification requests exist', async () => {
    mockVerificationFindFirst.mockResolvedValue(null);
    const result = await getVerificationStatus(USER_ID);
    expect(result).toBeNull();
  });

  it('returns status DTO for existing request', async () => {
    mockVerificationFindFirst.mockResolvedValue({
      status: VerificationStatus.PENDING,
      idDocType: 'PASSPORT',
      submittedAt: new Date('2026-05-01T10:00:00Z'),
      reviewedAt: null,
      reviewNote: null,
    });

    const result = await getVerificationStatus(USER_ID);

    expect(result?.status).toBe(VerificationStatus.PENDING);
    expect(result?.idDocType).toBe('PASSPORT');
    expect(result?.reviewedAt).toBeNull();
  });

  it('includes reviewedAt when present', async () => {
    mockVerificationFindFirst.mockResolvedValue({
      status: VerificationStatus.APPROVED,
      idDocType: 'PASSPORT',
      submittedAt: new Date('2026-05-01T10:00:00Z'),
      reviewedAt: new Date('2026-05-03T10:00:00Z'),
      reviewNote: 'Looks good',
    });

    const result = await getVerificationStatus(USER_ID);
    expect(result?.reviewedAt).not.toBeNull();
    expect(result?.reviewNote).toBe('Looks good');
  });
});

// ── getTrustScore ──────────────────────────────────────────────────────────────

describe('getTrustScore', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns full score for phone-verified user with approved verification and voice intro', async () => {
    mockUserFindUnique.mockResolvedValue({ isPhoneVerified: true });
    mockVerificationFindFirst.mockResolvedValue({ id: 'ver-1' });
    mockMediaFindFirst.mockResolvedValue({ id: 'media-1' });

    const result = await getTrustScore(USER_ID);

    expect(result.layers.phone).toBe(TRUST_LAYERS.PHONE);
    expect(result.layers.face).toBe(TRUST_LAYERS.FACE);
    expect(result.layers.voice).toBe(TRUST_LAYERS.VOICE);
    expect(result.layers.work).toBe(0);
    expect(result.layers.education).toBe(0);
    expect(result.total).toBe(TRUST_LAYERS.PHONE + TRUST_LAYERS.FACE + TRUST_LAYERS.VOICE);
  });

  it('returns zero score for unverified user with no verification or voice', async () => {
    mockUserFindUnique.mockResolvedValue({ isPhoneVerified: false });
    mockVerificationFindFirst.mockResolvedValue(null);
    mockMediaFindFirst.mockResolvedValue(null);

    const result = await getTrustScore(USER_ID);

    expect(result.total).toBe(0);
    expect(result.layers.phone).toBe(0);
    expect(result.layers.face).toBe(0);
    expect(result.layers.voice).toBe(0);
  });

  it('includes correct max value', async () => {
    mockUserFindUnique.mockResolvedValue({ isPhoneVerified: false });
    mockVerificationFindFirst.mockResolvedValue(null);
    mockMediaFindFirst.mockResolvedValue(null);

    const result = await getTrustScore(USER_ID);
    const expectedMax = TRUST_LAYERS.PHONE + TRUST_LAYERS.FACE + TRUST_LAYERS.VOICE + TRUST_LAYERS.WORK + TRUST_LAYERS.EDUCATION;
    expect(result.max).toBe(expectedMax);
  });

  it('handles missing user gracefully (phone not verified)', async () => {
    mockUserFindUnique.mockResolvedValue(null);
    mockVerificationFindFirst.mockResolvedValue(null);
    mockMediaFindFirst.mockResolvedValue(null);

    const result = await getTrustScore(USER_ID);
    expect(result.layers.phone).toBe(0);
  });
});

// ── getVerificationUploadUrl ───────────────────────────────────────────────────

describe('getVerificationUploadUrl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetStorageAdapter.mockReturnValue({
      getPresignedUploadUrl: jest.fn().mockResolvedValue({
        uploadUrl: 'https://s3.example.com/presigned',
        fileUrl: 'https://cdn.example.com/file.jpg',
      }),
    });
  });

  it('returns a presigned URL and s3Key for id_document', async () => {
    const result = await getVerificationUploadUrl(USER_ID, 'id_document', 'image/jpeg');

    expect(result.uploadUrl).toBe('https://s3.example.com/presigned');
    expect(result.s3Key).toMatch(/^verification\/user-uuid-1\/id_document-/);
    expect(result.s3Key).toMatch(/\.jpeg$/);
  });

  it('returns a presigned URL and s3Key for selfie', async () => {
    const result = await getVerificationUploadUrl(USER_ID, 'selfie', 'image/png');

    expect(result.s3Key).toMatch(/^verification\/user-uuid-1\/selfie-/);
    expect(result.s3Key).toMatch(/\.png$/);
  });

  it('uses jpg as fallback extension when mimeType has no subtype', async () => {
    const result = await getVerificationUploadUrl(USER_ID, 'selfie', 'image');
    expect(result.s3Key).toMatch(/\.jpg$/);
  });
});
