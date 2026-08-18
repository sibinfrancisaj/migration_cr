/**
 * Phase G tests — collaborative-filter.service.ts
 */

// ── DB mock ───────────────────────────────────────────────────────────────────

const mockConnectionFindMany  = jest.fn();
const mockSavedFindMany       = jest.fn();
const mockViewFindMany        = jest.fn();
const mockQueryRaw            = jest.fn();

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    connectionRequest: { findMany: (...a: unknown[]) => mockConnectionFindMany(...a) },
    savedProfile:      { findMany: (...a: unknown[]) => mockSavedFindMany(...a) },
    profileView:       { findMany: (...a: unknown[]) => mockViewFindMany(...a) },
    $queryRaw:         (...a: unknown[]) => mockQueryRaw(...a),
  },
}));

jest.mock('@abroad-matrimony/logger', () => ({
  createChildLogger: () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
  }),
}));

import { collaborativeFilter } from '../collaborative-filter.service.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const USER       = 'user-aaaa';
const TARGET1    = 'target-1111';
const TARGET2    = 'target-2222';
const NEIGHBOUR1 = 'neighbour-1';
const CANDIDATE1 = 'candidate-A';
const CANDIDATE2 = 'candidate-B';

/**
 * Sets up the full happy-path mock call sequence.
 *
 * Call order (matches service execution):
 *   findNeighbourhood: connectionRequest.findMany #1, savedProfile.findMany #1, profileView.findMany #1
 *   $queryRaw #1
 *   scoreCandidates (user exclusion): connectionRequest.findMany #2, savedProfile.findMany #2, profileView.findMany #2
 *   scoreCandidates (neighbours): connectionRequest.findMany #3, savedProfile.findMany #3, profileView.findMany #3
 */
function setHappyPath(): void {
  // findNeighbourhood — user's own interaction targets
  mockConnectionFindMany.mockResolvedValueOnce([{ receiverId: TARGET1 }]);
  mockSavedFindMany.mockResolvedValueOnce([{ savedUserId: TARGET2 }]);
  mockViewFindMany.mockResolvedValueOnce([]);

  // findNeighbourhood — neighbourhood raw query
  mockQueryRaw.mockResolvedValueOnce([
    { neighbourId: NEIGHBOUR1, sharedActions: BigInt(2) },
  ]);

  // scoreCandidates — user's own existing interactions (for exclusion)
  mockConnectionFindMany.mockResolvedValueOnce([]);
  mockSavedFindMany.mockResolvedValueOnce([]);
  mockViewFindMany.mockResolvedValueOnce([]);

  // scoreCandidates — neighbour interactions (the candidates)
  mockConnectionFindMany.mockResolvedValueOnce([{ receiverId: CANDIDATE1 }]);
  mockSavedFindMany.mockResolvedValueOnce([{ savedUserId: CANDIDATE2 }]);
  mockViewFindMany.mockResolvedValueOnce([{ viewedId: CANDIDATE1 }]);
}

beforeEach(() => jest.resetAllMocks());

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('collaborativeFilter()', () => {
  it('returns candidates ranked by interaction score', async () => {
    setHappyPath();
    const result = await collaborativeFilter(USER, 10);
    // CANDIDATE1 appears in both connections (weight 3) + views (weight 1) = 4
    // CANDIDATE2 appears in saves (weight 2) = 2
    expect(result[0]).toBe(CANDIDATE1);
    expect(result).toContain(CANDIDATE2);
  });

  it('returns [] when user has no interactions (no targets → no neighbourhood query)', async () => {
    mockConnectionFindMany.mockResolvedValueOnce([]);
    mockSavedFindMany.mockResolvedValueOnce([]);
    mockViewFindMany.mockResolvedValueOnce([]);

    const result = await collaborativeFilter(USER, 10);
    expect(result).toEqual([]);
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it('returns [] when neighbourhood query finds no neighbours', async () => {
    mockConnectionFindMany.mockResolvedValueOnce([{ receiverId: TARGET1 }]);
    mockSavedFindMany.mockResolvedValueOnce([]);
    mockViewFindMany.mockResolvedValueOnce([]);
    mockQueryRaw.mockResolvedValueOnce([]);

    const result = await collaborativeFilter(USER, 10);
    expect(result).toEqual([]);
  });

  it('respects the limit parameter', async () => {
    setHappyPath();
    const result = await collaborativeFilter(USER, 1);
    expect(result.length).toBeLessThanOrEqual(1);
  });

  it('excludes ids in excludeIds list', async () => {
    setHappyPath();
    const result = await collaborativeFilter(USER, 10, [CANDIDATE1]);
    expect(result).not.toContain(CANDIDATE1);
  });

  it('returns [] and swallows all errors (fire-and-forget safe)', async () => {
    mockConnectionFindMany.mockRejectedValueOnce(new Error('DB down'));
    const result = await collaborativeFilter(USER, 10);
    expect(result).toEqual([]);
  });

  it('does not re-surface profiles the user already connected to', async () => {
    // findNeighbourhood: user connected TARGET1
    mockConnectionFindMany.mockResolvedValueOnce([{ receiverId: TARGET1 }]);
    mockSavedFindMany.mockResolvedValueOnce([]);
    mockViewFindMany.mockResolvedValueOnce([]);

    mockQueryRaw.mockResolvedValueOnce([{ neighbourId: NEIGHBOUR1, sharedActions: BigInt(1) }]);

    // scoreCandidates user exclusion: user already connected to CANDIDATE1
    mockConnectionFindMany.mockResolvedValueOnce([{ receiverId: CANDIDATE1 }]);
    mockSavedFindMany.mockResolvedValueOnce([]);
    mockViewFindMany.mockResolvedValueOnce([]);

    // neighbour interacted with CANDIDATE1 — but user already connected, should exclude
    mockConnectionFindMany.mockResolvedValueOnce([{ receiverId: CANDIDATE1 }]);
    mockSavedFindMany.mockResolvedValueOnce([]);
    mockViewFindMany.mockResolvedValueOnce([]);

    const result = await collaborativeFilter(USER, 10);
    expect(result).not.toContain(CANDIDATE1);
  });
});
