import {
  listSavedProfiles,
  saveProfile,
  updateSavedProfile,
  unsaveProfile,
  compareSavedProfiles,
  SavedProfileNotFoundError,
  AlreadySavedError,
  SaveSelfError,
  ProfileNotSavedError,
} from '../index.js';
import { SavedProfileLabel } from '@abroad-matrimony/shared';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockSavedProfileFindMany  = jest.fn();
const mockSavedProfileFindUnique = jest.fn();
const mockSavedProfileCreate    = jest.fn();
const mockSavedProfileUpdate    = jest.fn();
const mockSavedProfileDelete    = jest.fn();

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    savedProfile: {
      findMany:   (...a: unknown[]) => mockSavedProfileFindMany(...a),
      findUnique: (...a: unknown[]) => mockSavedProfileFindUnique(...a),
      create:     (...a: unknown[]) => mockSavedProfileCreate(...a),
      update:     (...a: unknown[]) => mockSavedProfileUpdate(...a),
      delete:     (...a: unknown[]) => mockSavedProfileDelete(...a),
    },
  },
}));

// ── Fixtures ───────────────────────────────────────────────────────────────────

const USER_ID       = 'user-uuid-1';
const SAVED_USER_ID = 'user-uuid-2';

const savedUserProfile = {
  name: 'Priya',
  currentCity: 'London',
  currentCountry: 'UK',
  verificationStatus: 'APPROVED',
};

function makeSavedRow(overrides: Partial<{
  id: string;
  userId: string;
  savedUserId: string;
  label: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  savedUser: { id: string; profile: typeof savedUserProfile | null };
}> = {}) {
  return {
    id:          overrides.id          ?? 'saved-1',
    userId:      overrides.userId      ?? USER_ID,
    savedUserId: overrides.savedUserId ?? SAVED_USER_ID,
    label:       overrides.label       ?? SavedProfileLabel.INTERESTED,
    notes:       overrides.notes       ?? null,
    createdAt:   overrides.createdAt   ?? new Date('2026-05-01'),
    updatedAt:   overrides.updatedAt   ?? new Date('2026-05-01'),
    savedUser: overrides.savedUser ?? { id: SAVED_USER_ID, profile: savedUserProfile },
  };
}

// ── listSavedProfiles ──────────────────────────────────────────────────────────

describe('listSavedProfiles', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns saved profiles without label filter', async () => {
    mockSavedProfileFindMany.mockResolvedValue([makeSavedRow()]);

    const result = await listSavedProfiles(USER_ID);

    expect(mockSavedProfileFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER_ID } }),
    );
    expect(result).toHaveLength(1);
    expect(result[0].savedUser?.name).toBe('Priya');
  });

  it('applies label filter when provided', async () => {
    mockSavedProfileFindMany.mockResolvedValue([makeSavedRow({ label: SavedProfileLabel.FAVOURITE })]);

    await listSavedProfiles(USER_ID, SavedProfileLabel.FAVOURITE);

    expect(mockSavedProfileFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_ID, label: SavedProfileLabel.FAVOURITE },
      }),
    );
  });

  it('returns null savedUser when profile does not exist', async () => {
    mockSavedProfileFindMany.mockResolvedValue([
      makeSavedRow({ savedUser: { id: SAVED_USER_ID, profile: null } }),
    ]);

    const result = await listSavedProfiles(USER_ID);
    expect(result[0].savedUser).toBeNull();
  });

  it('returns empty array when no saved profiles', async () => {
    mockSavedProfileFindMany.mockResolvedValue([]);
    const result = await listSavedProfiles(USER_ID);
    expect(result).toEqual([]);
  });
});

// ── saveProfile ────────────────────────────────────────────────────────────────

describe('saveProfile', () => {
  beforeEach(() => jest.clearAllMocks());

  it('saves a profile with default label INTERESTED', async () => {
    mockSavedProfileFindUnique.mockResolvedValue(null);
    mockSavedProfileCreate.mockResolvedValue(makeSavedRow());

    const result = await saveProfile(USER_ID, SAVED_USER_ID);

    expect(mockSavedProfileCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: USER_ID,
          savedUserId: SAVED_USER_ID,
          label: SavedProfileLabel.INTERESTED,
        }),
      }),
    );
    expect(result.savedUserId).toBe(SAVED_USER_ID);
  });

  it('saves a profile with custom label and notes', async () => {
    mockSavedProfileFindUnique.mockResolvedValue(null);
    mockSavedProfileCreate.mockResolvedValue(
      makeSavedRow({ label: SavedProfileLabel.FAVOURITE, notes: 'Met at the event' }),
    );

    const result = await saveProfile(USER_ID, SAVED_USER_ID, SavedProfileLabel.FAVOURITE, 'Met at the event');
    expect(result.notes).toBe('Met at the event');
  });

  it('throws SaveSelfError when trying to save own profile', async () => {
    await expect(saveProfile(USER_ID, USER_ID)).rejects.toBeInstanceOf(SaveSelfError);
    expect(mockSavedProfileFindUnique).not.toHaveBeenCalled();
  });

  it('throws AlreadySavedError when profile is already saved', async () => {
    mockSavedProfileFindUnique.mockResolvedValue({ id: 'saved-1' });
    await expect(saveProfile(USER_ID, SAVED_USER_ID)).rejects.toBeInstanceOf(AlreadySavedError);
    expect(mockSavedProfileCreate).not.toHaveBeenCalled();
  });
});

// ── updateSavedProfile ─────────────────────────────────────────────────────────

describe('updateSavedProfile', () => {
  beforeEach(() => jest.clearAllMocks());

  it('updates label and notes', async () => {
    mockSavedProfileFindUnique.mockResolvedValue({ id: 'saved-1' });
    mockSavedProfileUpdate.mockResolvedValue(
      makeSavedRow({ label: SavedProfileLabel.MAYBE, notes: 'Consider later' }),
    );

    const result = await updateSavedProfile(USER_ID, SAVED_USER_ID, {
      label: SavedProfileLabel.MAYBE,
      notes: 'Consider later',
    });

    expect(mockSavedProfileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_savedUserId: { userId: USER_ID, savedUserId: SAVED_USER_ID } },
        data: expect.objectContaining({
          label: SavedProfileLabel.MAYBE,
          notes: 'Consider later',
        }),
      }),
    );
    expect(result.label).toBe(SavedProfileLabel.MAYBE);
  });

  it('throws SavedProfileNotFoundError when not found', async () => {
    mockSavedProfileFindUnique.mockResolvedValue(null);

    await expect(updateSavedProfile(USER_ID, SAVED_USER_ID, { label: SavedProfileLabel.MAYBE })).rejects.toBeInstanceOf(
      SavedProfileNotFoundError,
    );
  });
});

// ── unsaveProfile ──────────────────────────────────────────────────────────────

describe('unsaveProfile', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deletes the saved profile record', async () => {
    mockSavedProfileFindUnique.mockResolvedValue({ id: 'saved-1' });
    mockSavedProfileDelete.mockResolvedValue({});

    await unsaveProfile(USER_ID, SAVED_USER_ID);

    expect(mockSavedProfileDelete).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_savedUserId: { userId: USER_ID, savedUserId: SAVED_USER_ID } },
      }),
    );
  });

  it('throws SavedProfileNotFoundError when profile is not saved', async () => {
    mockSavedProfileFindUnique.mockResolvedValue(null);

    await expect(unsaveProfile(USER_ID, SAVED_USER_ID)).rejects.toBeInstanceOf(
      SavedProfileNotFoundError,
    );
  });
});

// ── compareSavedProfiles ───────────────────────────────────────────────────────

const SAVED_USER_ID_2 = 'user-uuid-3';

function makeCompareRow(savedUserId: string, idx: number) {
  return {
    id: `saved-${idx}`,
    userId: USER_ID,
    savedUserId,
    label: SavedProfileLabel.INTERESTED,
    notes: null,
    savedUser: {
      id: savedUserId,
      profile: {
        name: `Profile ${idx}`,
        dateOfBirth: new Date('1995-01-01'),
        gender: 'FEMALE',
        currentCity: 'London',
        currentCountry: 'UK',
        settlementIntent: 'SETTLE_ABROAD',
        bio: null,
        completionScore: 80,
        verificationStatus: 'APPROVED',
        trustScore: 5,
        realLifeAnswers: [{ questionKey: 'q1', answer: 'yes' }],
      },
    },
  };
}

describe('compareSavedProfiles', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns enriched data for each saved profile ID', async () => {
    mockSavedProfileFindMany.mockResolvedValue([
      makeCompareRow(SAVED_USER_ID, 1),
      makeCompareRow(SAVED_USER_ID_2, 2),
    ]);

    const result = await compareSavedProfiles(USER_ID, [SAVED_USER_ID, SAVED_USER_ID_2]);

    expect(result).toHaveLength(2);
    expect(result[0].savedUserId).toBe(SAVED_USER_ID);
    expect(result[0].realLifeAnswers).toEqual([{ questionKey: 'q1', answer: 'yes' }]);
    expect(result[1].savedUserId).toBe(SAVED_USER_ID_2);
  });

  it('preserves the order of the requested profile IDs', async () => {
    mockSavedProfileFindMany.mockResolvedValue([
      makeCompareRow(SAVED_USER_ID, 1),
      makeCompareRow(SAVED_USER_ID_2, 2),
    ]);

    const result = await compareSavedProfiles(USER_ID, [SAVED_USER_ID_2, SAVED_USER_ID]);

    expect(result[0].savedUserId).toBe(SAVED_USER_ID_2);
    expect(result[1].savedUserId).toBe(SAVED_USER_ID);
  });

  it('throws ProfileNotSavedError when a profile ID is not in the saved list', async () => {
    mockSavedProfileFindMany.mockResolvedValue([makeCompareRow(SAVED_USER_ID, 1)]);

    await expect(
      compareSavedProfiles(USER_ID, [SAVED_USER_ID, SAVED_USER_ID_2]),
    ).rejects.toBeInstanceOf(ProfileNotSavedError);
  });

  it('returns null profile fields when user has no profile row', async () => {
    const row = makeCompareRow(SAVED_USER_ID, 1);
    (row.savedUser as any).profile = null;
    mockSavedProfileFindMany.mockResolvedValue([row, makeCompareRow(SAVED_USER_ID_2, 2)]);

    const result = await compareSavedProfiles(USER_ID, [SAVED_USER_ID, SAVED_USER_ID_2]);
    expect(result[0].profile).toBeNull();
    expect(result[0].realLifeAnswers).toEqual([]);
  });
});
