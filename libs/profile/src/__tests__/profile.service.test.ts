import { createProfileService, getOwnProfile, getProfileById, ProfileAlreadyExistsError } from '../profile.service.js';
import { ProfileNotFoundError } from '../real-life-answer.service.js';
import { Gender, MediaType, RealLifeQuestionKey, StoryPromptKey, VerificationStatus } from '@abroad-matrimony/shared';

// ── DB mock ───────────────────────────────────────────────────────────────────

const mockFindUnique            = jest.fn();
const mockCreate                = jest.fn();
const mockRlAnswersFindMany     = jest.fn();
const mockStoryAnswersFindMany  = jest.fn();
const mockMediaFindMany         = jest.fn();

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    profile: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      create:     (...args: unknown[]) => mockCreate(...args),
    },
    realLifeAnswer: {
      findMany: (...args: unknown[]) => mockRlAnswersFindMany(...args),
    },
    storyPromptAnswer: {
      findMany: (...args: unknown[]) => mockStoryAnswersFindMany(...args),
    },
    media: {
      findMany: (...args: unknown[]) => mockMediaFindMany(...args),
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
    // Unused by createProfileService but set to safe defaults to avoid unhandled rejections
    mockRlAnswersFindMany.mockResolvedValue([]);
    mockStoryAnswersFindMany.mockResolvedValue([]);
    mockMediaFindMany.mockResolvedValue([]);
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

// ── Fixtures for get-profile tests ────────────────────────────────────────────

const DB_RL_ANSWER = {
  id:          'answer-uuid-1',
  userId:      'user-uuid-1',
  questionKey: RealLifeQuestionKey.DIET,
  value:       'Vegetarian',
  updatedAt:   new Date('2026-05-27T10:00:00.000Z'),
};

const DB_STORY_ANSWER = {
  id:        'story-uuid-1',
  userId:    'user-uuid-1',
  promptKey: StoryPromptKey.DEAL_BREAKER,
  answer:    'Dishonesty is my deal breaker.',
  updatedAt: new Date('2026-05-27T10:00:00.000Z'),
};

const DB_PHOTO = {
  id:         'media-uuid-1',
  userId:     'user-uuid-1',
  type:       MediaType.PHOTO,
  s3Key:      'photos/user-uuid-1/1.jpg',
  url:        'https://cdn.example.com/1.jpg',
  order:      1,
  isVerified: false,
  createdAt:  new Date('2026-05-27T10:00:00.000Z'),
};

// ── getOwnProfile() ───────────────────────────────────────────────────────────

describe('getOwnProfile()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindUnique.mockResolvedValue(DB_PROFILE_ROW);
    mockRlAnswersFindMany.mockResolvedValue([]);
    mockStoryAnswersFindMany.mockResolvedValue([]);
    mockMediaFindMany.mockResolvedValue([]);
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it('returns a ProfileDto for the authenticated user', async () => {
    const result = await getOwnProfile('user-uuid-1');

    expect(result.id).toBe('profile-uuid-1');
    expect(result.userId).toBe('user-uuid-1');
    expect(result.name).toBe('Priya Sharma');
    expect(result.gender).toBe(Gender.FEMALE);
    expect(result.verificationStatus).toBe(VerificationStatus.PENDING);
    expect(result.isVerified).toBe(false);
  });

  it('returns empty arrays when no answers or photos exist yet', async () => {
    const result = await getOwnProfile('user-uuid-1');

    expect(result.realLifeAnswers).toEqual([]);
    expect(result.storyPrompts).toEqual([]);
    expect(result.photos).toEqual([]);
  });

  it('maps realLifeAnswers from DB rows to RealLifeAnswerDto', async () => {
    mockRlAnswersFindMany.mockResolvedValueOnce([DB_RL_ANSWER]);

    const result = await getOwnProfile('user-uuid-1');

    expect(result.realLifeAnswers).toHaveLength(1);
    expect(result.realLifeAnswers[0].questionKey).toBe(RealLifeQuestionKey.DIET);
    expect(result.realLifeAnswers[0].value).toBe('Vegetarian');
    expect(result.realLifeAnswers[0].updatedAt).toBeInstanceOf(Date);
  });

  it('maps storyPrompts from DB rows to StoryPromptAnswerDto', async () => {
    mockStoryAnswersFindMany.mockResolvedValueOnce([DB_STORY_ANSWER]);

    const result = await getOwnProfile('user-uuid-1');

    expect(result.storyPrompts).toHaveLength(1);
    expect(result.storyPrompts[0].promptKey).toBe(StoryPromptKey.DEAL_BREAKER);
    expect(result.storyPrompts[0].answer).toBe('Dishonesty is my deal breaker.');
    expect(result.storyPrompts[0].updatedAt).toBeInstanceOf(Date);
  });

  it('maps photos from DB rows to MediaDto', async () => {
    mockMediaFindMany.mockResolvedValueOnce([DB_PHOTO]);

    const result = await getOwnProfile('user-uuid-1');

    expect(result.photos).toHaveLength(1);
    expect(result.photos[0].id).toBe('media-uuid-1');
    expect(result.photos[0].type).toBe(MediaType.PHOTO);
    expect(result.photos[0].url).toBe('https://cdn.example.com/1.jpg');
    expect(result.photos[0].order).toBe(1);
    expect(result.photos[0].isVerified).toBe(false);
  });

  it('sets isVerified true when verificationStatus is APPROVED', async () => {
    mockFindUnique.mockResolvedValueOnce({ ...DB_PROFILE_ROW, verificationStatus: 'APPROVED' });

    const result = await getOwnProfile('user-uuid-1');

    expect(result.isVerified).toBe(true);
  });

  it('maps null bio to undefined in the DTO', async () => {
    mockFindUnique.mockResolvedValueOnce({ ...DB_PROFILE_ROW, bio: null });

    const result = await getOwnProfile('user-uuid-1');

    expect(result.bio).toBeUndefined();
  });

  // ── Not found ─────────────────────────────────────────────────────────────

  it('throws ProfileNotFoundError when the user has no profile', async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    await expect(getOwnProfile('user-uuid-1')).rejects.toThrow(ProfileNotFoundError);
  });

  // ── Error propagation ─────────────────────────────────────────────────────

  it('re-throws unexpected errors from Promise.all', async () => {
    mockRlAnswersFindMany.mockRejectedValueOnce(new Error('DB connection lost'));

    await expect(getOwnProfile('user-uuid-1')).rejects.toThrow('DB connection lost');
  });
});

// ── getProfileById() ──────────────────────────────────────────────────────────

describe('getProfileById()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindUnique.mockResolvedValue(DB_PROFILE_ROW);
    mockRlAnswersFindMany.mockResolvedValue([]);
    mockStoryAnswersFindMany.mockResolvedValue([]);
    mockMediaFindMany.mockResolvedValue([]);
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it('returns a ProfileDto for the given profile ID', async () => {
    const result = await getProfileById('profile-uuid-1');

    expect(result.id).toBe('profile-uuid-1');
    expect(result.userId).toBe('user-uuid-1');
    expect(result.name).toBe('Priya Sharma');
  });

  it('passes the profile ID to prisma.profile.findUnique', async () => {
    await getProfileById('profile-uuid-1');

    expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: 'profile-uuid-1' } });
  });

  it('uses userId from the found profile to query related data', async () => {
    await getProfileById('profile-uuid-1');

    expect(mockRlAnswersFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 'user-uuid-1' }) }),
    );
  });

  it('returns nested data including answers and photos', async () => {
    mockRlAnswersFindMany.mockResolvedValueOnce([DB_RL_ANSWER]);
    mockStoryAnswersFindMany.mockResolvedValueOnce([DB_STORY_ANSWER]);
    mockMediaFindMany.mockResolvedValueOnce([DB_PHOTO]);

    const result = await getProfileById('profile-uuid-1');

    expect(result.realLifeAnswers).toHaveLength(1);
    expect(result.storyPrompts).toHaveLength(1);
    expect(result.photos).toHaveLength(1);
  });

  // ── Not found ─────────────────────────────────────────────────────────────

  it('throws ProfileNotFoundError when no profile exists for the given ID', async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    await expect(getProfileById('profile-uuid-1')).rejects.toThrow(ProfileNotFoundError);
  });

  it('does not call findMany when the profile is not found', async () => {
    mockFindUnique.mockResolvedValueOnce(null);

    await expect(getProfileById('profile-uuid-1')).rejects.toThrow();

    expect(mockRlAnswersFindMany).not.toHaveBeenCalled();
    expect(mockStoryAnswersFindMany).not.toHaveBeenCalled();
    expect(mockMediaFindMany).not.toHaveBeenCalled();
  });

  // ── Error propagation ─────────────────────────────────────────────────────

  it('re-throws unexpected errors from prisma.profile.findUnique', async () => {
    mockFindUnique.mockRejectedValueOnce(new Error('DB connection lost'));

    await expect(getProfileById('profile-uuid-1')).rejects.toThrow('DB connection lost');
  });
});
