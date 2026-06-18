import {
  listAllDrops,
  getDropAdmin,
  approveDrop,
  updateDropMembers,
  scheduleDropRelease,
  proposeNewDrop,
  DropNotDraftError,
  DropNotEditableError,
  DropMemberPoolTooSmallError,
} from '../drop-admin.service.js';
import { IntroductionDropNotFoundError } from '../drop.service.js';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockDropFindMany   = jest.fn();
const mockDropFindUnique = jest.fn();
const mockDropUpdate     = jest.fn();
const mockDropCreate     = jest.fn();
// generatePairingsForDrop is imported by drop-admin.service — mock the module
const mockGeneratePairings = jest.fn().mockResolvedValue(undefined);

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    introductionDrop: {
      findMany:   (...a: unknown[]) => mockDropFindMany(...a),
      findUnique: (...a: unknown[]) => mockDropFindUnique(...a),
      update:     (...a: unknown[]) => mockDropUpdate(...a),
      create:     (...a: unknown[]) => mockDropCreate(...a),
    },
  },
}));

// Mock pairing service to avoid transitive prisma calls
jest.mock('../pairing.service.js', () => ({
  generatePairingsForDrop: (...a: unknown[]) => mockGeneratePairings(...a),
}));

// ── Fixtures ───────────────────────────────────────────────────────────────────

const DROP_ID   = 'drop-uuid-1';
const FUTURE_DATE = new Date(Date.now() + 7 * 86_400_000);
const MEMBER_A = 'aaaa-uuid';
const MEMBER_B = 'bbbb-uuid';

function makeDrop(overrides: Record<string, unknown> = {}) {
  return {
    id:              DROP_ID,
    name:            'London Drop',
    criteria:        {},
    status:          'DRAFT',
    memberPool:      [MEMBER_A, MEMBER_B],
    releaseAt:       FUTURE_DATE,
    expiresAt:       FUTURE_DATE,
    earlyAccessCost: 5,
    unlockCost:      10,
    createdAt:       new Date('2026-05-01'),
    _count:          { introductions: 0 },
    ...overrides,
  };
}

// ── listAllDrops ───────────────────────────────────────────────────────────────

describe('listAllDrops', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns all drops without status filter', async () => {
    mockDropFindMany.mockResolvedValue([makeDrop()]);
    const result = await listAllDrops();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(DROP_ID);
    expect(result[0].pairingCount).toBe(0);
    expect(mockDropFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: undefined }),
    );
  });

  it('filters by status when provided', async () => {
    mockDropFindMany.mockResolvedValue([makeDrop({ status: 'LIVE' })]);
    await listAllDrops({ status: 'LIVE' });
    expect(mockDropFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'LIVE' } }),
    );
  });

  it('returns empty array when no drops', async () => {
    mockDropFindMany.mockResolvedValue([]);
    const result = await listAllDrops();
    expect(result).toEqual([]);
  });
});

// ── getDropAdmin ───────────────────────────────────────────────────────────────

describe('getDropAdmin', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns admin drop DTO with memberPool and pairingCount', async () => {
    mockDropFindUnique.mockResolvedValue(makeDrop({ _count: { introductions: 3 } }));
    const result = await getDropAdmin(DROP_ID);
    expect(result.id).toBe(DROP_ID);
    expect(result.memberPool).toEqual([MEMBER_A, MEMBER_B]);
    expect(result.pairingCount).toBe(3);
  });

  it('throws IntroductionDropNotFoundError when not found', async () => {
    mockDropFindUnique.mockResolvedValue(null);
    await expect(getDropAdmin(DROP_ID)).rejects.toBeInstanceOf(IntroductionDropNotFoundError);
  });
});

// ── approveDrop ────────────────────────────────────────────────────────────────

describe('approveDrop', () => {
  beforeEach(() => jest.clearAllMocks());

  it('transitions DRAFT to PENDING_APPROVAL and fires pairing generation', async () => {
    mockDropFindUnique.mockResolvedValue(makeDrop({ status: 'DRAFT' }));
    mockDropUpdate.mockResolvedValue(makeDrop({ status: 'PENDING_APPROVAL' }));

    const result = await approveDrop(DROP_ID);

    expect(mockDropUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'PENDING_APPROVAL' } }),
    );
    expect(result.status).toBe('PENDING_APPROVAL');
    // Let pairing generation run (it's async, give it a tick)
    await new Promise((r) => setTimeout(r, 10));
    expect(mockGeneratePairings).toHaveBeenCalledWith(DROP_ID);
  });

  it('throws IntroductionDropNotFoundError when drop not found', async () => {
    mockDropFindUnique.mockResolvedValue(null);
    await expect(approveDrop(DROP_ID)).rejects.toBeInstanceOf(IntroductionDropNotFoundError);
  });

  it('throws DropNotDraftError when drop is not DRAFT', async () => {
    mockDropFindUnique.mockResolvedValue(makeDrop({ status: 'SCHEDULED' }));
    await expect(approveDrop(DROP_ID)).rejects.toBeInstanceOf(DropNotDraftError);
  });
});

// ── updateDropMembers ──────────────────────────────────────────────────────────

describe('updateDropMembers', () => {
  beforeEach(() => jest.clearAllMocks());

  it('updates member pool for a DRAFT drop', async () => {
    const newPool = [MEMBER_A, MEMBER_B, 'cccc-uuid'];
    mockDropFindUnique.mockResolvedValue(makeDrop({ status: 'DRAFT' }));
    mockDropUpdate.mockResolvedValue(makeDrop({ memberPool: newPool }));

    const result = await updateDropMembers(DROP_ID, newPool);
    expect(mockDropUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { memberPool: newPool } }),
    );
    expect(result.memberPool).toEqual(newPool);
  });

  it('throws DropMemberPoolTooSmallError when pool has fewer than 2 members', async () => {
    await expect(updateDropMembers(DROP_ID, ['only-one'])).rejects.toBeInstanceOf(DropMemberPoolTooSmallError);
  });

  it('throws IntroductionDropNotFoundError when drop not found', async () => {
    mockDropFindUnique.mockResolvedValue(null);
    await expect(updateDropMembers(DROP_ID, [MEMBER_A, MEMBER_B])).rejects.toBeInstanceOf(IntroductionDropNotFoundError);
  });

  it('throws DropNotEditableError when drop is LIVE', async () => {
    mockDropFindUnique.mockResolvedValue(makeDrop({ status: 'LIVE' }));
    await expect(updateDropMembers(DROP_ID, [MEMBER_A, MEMBER_B])).rejects.toBeInstanceOf(DropNotEditableError);
  });
});

// ── scheduleDropRelease ────────────────────────────────────────────────────────

describe('scheduleDropRelease', () => {
  beforeEach(() => jest.clearAllMocks());

  it('updates releaseAt for a SCHEDULED drop', async () => {
    const newDate = new Date(Date.now() + 14 * 86_400_000);
    mockDropFindUnique.mockResolvedValue(makeDrop({ status: 'SCHEDULED' }));
    mockDropUpdate.mockResolvedValue(makeDrop({ releaseAt: newDate }));

    const result = await scheduleDropRelease(DROP_ID, newDate);
    expect(mockDropUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { releaseAt: newDate } }),
    );
    expect(result.releaseAt).toBe(newDate.toISOString());
  });

  it('throws IntroductionDropNotFoundError when drop not found', async () => {
    mockDropFindUnique.mockResolvedValue(null);
    await expect(scheduleDropRelease(DROP_ID, new Date())).rejects.toBeInstanceOf(IntroductionDropNotFoundError);
  });

  it('throws DropNotEditableError when drop is LIVE', async () => {
    mockDropFindUnique.mockResolvedValue(makeDrop({ status: 'LIVE' }));
    await expect(scheduleDropRelease(DROP_ID, new Date())).rejects.toBeInstanceOf(DropNotEditableError);
  });
});

// ── proposeNewDrop ─────────────────────────────────────────────────────────────

describe('proposeNewDrop', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a new DRAFT drop', async () => {
    mockDropCreate.mockResolvedValue(makeDrop({ status: 'DRAFT' }));

    const result = await proposeNewDrop({
      name: 'London Drop',
      memberPool: [MEMBER_A, MEMBER_B],
    });

    expect(mockDropCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'London Drop', status: 'DRAFT' }),
      }),
    );
    expect(result.status).toBe('DRAFT');
  });

  it('throws DropMemberPoolTooSmallError when pool has fewer than 2 members', async () => {
    await expect(
      proposeNewDrop({ name: 'Drop', memberPool: ['only-one'] }),
    ).rejects.toBeInstanceOf(DropMemberPoolTooSmallError);
  });

  it('applies provided earlyAccessCost and releaseAt', async () => {
    const releaseAt = new Date(Date.now() + 7 * 86_400_000).toISOString();
    mockDropCreate.mockResolvedValue(makeDrop({ earlyAccessCost: 10, unlockCost: 20 }));

    await proposeNewDrop({
      name: 'Special Drop',
      memberPool: [MEMBER_A, MEMBER_B],
      earlyAccessCost: 10,
      unlockCost: 20,
      releaseAt,
    });

    expect(mockDropCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          earlyAccessCost: 10,
          unlockCost: 20,
          releaseAt: new Date(releaseAt),
        }),
      }),
    );
  });
});
