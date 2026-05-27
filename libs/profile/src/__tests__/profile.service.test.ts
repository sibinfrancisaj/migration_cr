import { createProfileService, ProfileAlreadyExistsError } from '../profile.service.js';
import { Gender, VerificationStatus } from '@abroad-matrimony/shared';

// ── DB mock ───────────────────────────────────────────────────────────────────

const mockFindUnique = jest.fn();
const mockCreate     = jest.fn();

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    profile: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      create:     (...args: unknown[]) => mockCreate(...args),
    },
  },
  PrismaClient: jest.fn(),
  Prisma: {},
}));

// ── Logger mock ───────────────────────────────────────────────────────────────

jest.mock('@abroad-matrimony/logger', () => ({
  createChildLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BASE_INPUT = {
  userId: 'user-uuid-1',
  name: 'Priya Sharma',
  dateOfBirth: new Date('1990-05-15'),
  gender: Gender.FEMALE,
  currentCity: 'London',
  currentCountry: 'United Kingdom',
  settlementIntent: 'UK or Canada',
  bio: 'Software engineer who loves hiking.',
};

const DB_PROFILE_ROW = {
  id: 'profile-uuid-1',
  userId: 'user-uuid-1',
  name: 'Priya Sharma',
  dateOfBirth: new Date('1990-05-15'),
  gender: 'FEMALE',
  currentCity: 'London',
  currentCountry: 'United Kingdom',
  settlementIntent: 'UK or Canada',
  bio: 'Software engineer who loves hiking.',
  completionScore: 0,
  verificationStatus: 'PENDING',
  createdAt: new Date('2026-05-27T10:00:00.000Z'),
  updatedAt: new Date('2026-05-27T10:00:00.000Z'),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('createProfileService()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindUnique.mockResolvedValue(null);  // no existing profile
    mockCreate.mockResolvedValue(DB_PROFILE_ROW);
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it('creates a profile and returns a ProfileDto', async () => {
    const result = await createProfileService(BASE_INPUT);

    expect(result.id).toBe('profile-uuid-1');
    expect(result.userId).toBe('user-uuid-1');
    expect(result.name).toBe('Priya Sharma');
    expect(result.gender).toBe(Gender.FEMALE);
    expect(result.currentCity).toBe('London');
    expect(result.completionScore).toBe(0);
    expect(result.verificationStatus).toBe(VerificationStatus.PENDING);
    expect(result.isVerified).toBe(false);
  });

  it('returns empty arrays for photos, realLifeAnswers, and storyPrompts', async () => {
    const result = await createProfileService(BASE_INPUT);

    expect(result.photos).toEqual([]);
    expect(result.realLifeAnswers).toEqual([]);
    expect(result.storyPrompts).toEqual([]);
  });

  it('passes all input fields through to prisma.profile.create', async () => {
    await createProfileService(BASE_INPUT);

    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-uuid-1',
        name: 'Priya Sharma',
        dateOfBirth: new Date('1990-05-15'),
        gender: Gender.FEMALE,
        currentCity: 'London',
        currentCountry: 'United Kingdom',
        settlementIntent: 'UK or Canada',
        bio: 'Software engineer who loves hiking.',
      }),
    });
  });

  it('creates profile without optional bio', async () => {
    const inputNoBio = { ...BASE_INPUT, bio: undefined };
    const rowNoBio   = { ...DB_PROFILE_ROW, bio: null };
    mockCreate.mockResolvedValueOnce(rowNoBio);

    const result = await createProfileService(inputNoBio);

    expect(result.bio).toBeUndefined();
    expect(mockCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ bio: undefined }),
    });
  });

  it('maps null bio from DB to undefined in the DTO', async () => {
    mockCreate.mockResolvedValueOnce({ ...DB_PROFILE_ROW, bio: null });

    const result = await createProfileService(BASE_INPUT);

    expect(result.bio).toBeUndefined();
  });

  it('sets isVerified to true when verificationStatus is APPROVED', async () => {
    mockCreate.mockResolvedValueOnce({
      ...DB_PROFILE_ROW,
      verificationStatus: 'APPROVED',
    });

    const result = await createProfileService(BASE_INPUT);

    expect(result.isVerified).toBe(true);
    expect(result.verificationStatus).toBe(VerificationStatus.APPROVED);
  });

  // ── 409 — profile already exists ─────────────────────────────────────────

  it('throws ProfileAlreadyExistsError when a profile already exists for the user', async () => {
    mockFindUnique.mockResolvedValueOnce(DB_PROFILE_ROW);

    await expect(createProfileService(BASE_INPUT)).rejects.toThrow(ProfileAlreadyExistsError);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('does not call prisma.profile.create when profile already exists', async () => {
    mockFindUnique.mockResolvedValueOnce(DB_PROFILE_ROW);

    await expect(createProfileService(BASE_INPUT)).rejects.toThrow();

    expect(mockCreate).not.toHaveBeenCalled();
  });

  // ── Error propagation ─────────────────────────────────────────────────────

  it('re-throws unexpected DB errors from findUnique', async () => {
    mockFindUnique.mockRejectedValueOnce(new Error('DB connection lost'));

    await expect(createProfileService(BASE_INPUT)).rejects.toThrow('DB connection lost');
  });

  it('re-throws unexpected DB errors from create', async () => {
    mockCreate.mockRejectedValueOnce(new Error('Constraint violation'));

    await expect(createProfileService(BASE_INPUT)).rejects.toThrow('Constraint violation');
  });
});
