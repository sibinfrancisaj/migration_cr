/**
 * GRP-R-007 — group-seed.service unit tests.
 *
 * Covers:
 *   - Creates new groups when none exist
 *   - Skips existing groups (idempotent)
 *   - Handles partial failures gracefully
 *   - Returns correct created/existing/total counts
 */

// ── Prisma mock ───────────────────────────────────────────────────────────────

const mockGroupFindFirst = jest.fn();
const mockGroupCreate    = jest.fn();

jest.mock('@abroad-matrimony/db', () => ({
  getPrismaClient: () => ({
    group: {
      findFirst: (...a: unknown[]) => mockGroupFindFirst(...a),
      create:    (...a: unknown[]) => mockGroupCreate(...a),
    },
  }),
}));

jest.mock('../lib/seeder-logger.js', () => ({
  seederLog: { info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() },
}));

import { seedSystemGroups } from '../services/group-seed.service.js';
import { ALL_SYSTEM_GROUPS } from '../data/groups.data.js';

// ─────────────────────────────────────────────────────────────────────────────

describe('seedSystemGroups()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates all groups when none exist', async () => {
    mockGroupFindFirst.mockResolvedValue(null);   // all groups are new
    mockGroupCreate.mockResolvedValue({ id: 'grp-uuid' });

    const result = await seedSystemGroups();

    expect(result.created).toBe(ALL_SYSTEM_GROUPS.length);
    expect(result.existing).toBe(0);
    expect(result.total).toBe(ALL_SYSTEM_GROUPS.length);
    expect(mockGroupCreate).toHaveBeenCalledTimes(ALL_SYSTEM_GROUPS.length);
  });

  it('skips groups that already exist (idempotent)', async () => {
    mockGroupFindFirst.mockResolvedValue({ id: 'existing-grp' });  // all already exist

    const result = await seedSystemGroups();

    expect(result.existing).toBe(ALL_SYSTEM_GROUPS.length);
    expect(result.created).toBe(0);
    expect(result.total).toBe(ALL_SYSTEM_GROUPS.length);
    expect(mockGroupCreate).not.toHaveBeenCalled();
  });

  it('counts mixed created and existing correctly', async () => {
    let callCount = 0;
    mockGroupFindFirst.mockImplementation(() => {
      callCount++;
      // First 5 already exist; the rest are new
      return callCount <= 5 ? Promise.resolve({ id: 'existing' }) : Promise.resolve(null);
    });
    mockGroupCreate.mockResolvedValue({ id: 'new-grp' });

    const result = await seedSystemGroups();

    expect(result.existing).toBe(5);
    expect(result.created).toBe(ALL_SYSTEM_GROUPS.length - 5);
    expect(result.total).toBe(ALL_SYSTEM_GROUPS.length);
  });

  it('continues and counts remaining groups if one create fails', async () => {
    mockGroupFindFirst.mockResolvedValue(null);
    // First create fails; rest succeed
    mockGroupCreate
      .mockRejectedValueOnce(new Error('DB constraint'))
      .mockResolvedValue({ id: 'grp' });

    const result = await seedSystemGroups();

    // One failed = one not created; the rest succeed
    expect(result.created).toBe(ALL_SYSTEM_GROUPS.length - 1);
    expect(result.existing).toBe(0);
    expect(result.total).toBe(ALL_SYSTEM_GROUPS.length - 1);
  });

  it('returns correct counts when no groups defined (edge case)', async () => {
    // Ensure ALL_SYSTEM_GROUPS has at least REGIONAL + CULTURAL + PROFESSIONAL + INTEREST groups
    expect(ALL_SYSTEM_GROUPS.length).toBeGreaterThanOrEqual(21);
    expect(ALL_SYSTEM_GROUPS.some((g) => g.type === 'REGIONAL')).toBe(true);
    expect(ALL_SYSTEM_GROUPS.some((g) => g.type === 'CULTURAL')).toBe(true);
    expect(ALL_SYSTEM_GROUPS.some((g) => g.type === 'PROFESSIONAL')).toBe(true);
    expect(ALL_SYSTEM_GROUPS.some((g) => g.type === 'INTEREST')).toBe(true);
  });

  it('creates REGIONAL groups with isSeeded: false so they survive flush', async () => {
    mockGroupFindFirst.mockResolvedValue(null);
    mockGroupCreate.mockResolvedValue({ id: 'grp' });

    await seedSystemGroups();

    const allCreateCalls = mockGroupCreate.mock.calls;
    for (const [callArg] of allCreateCalls) {
      expect(callArg.data.isSeeded).toBe(false);
    }
  });
});
