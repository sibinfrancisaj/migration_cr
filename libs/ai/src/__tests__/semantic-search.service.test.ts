/**
 * Tests for semantic-search.service — mergeWithRRF, mergeWithWeightedRRF,
 * and getSemanticallySimilarUsers (DB mocked).
 */

// ── DB mock ───────────────────────────────────────────────────────────────────
const mockQueryRaw        = jest.fn();
const mockQueryRawUnsafe  = jest.fn();

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    $queryRaw:       (...a: unknown[]) => mockQueryRaw(...a),
    $queryRawUnsafe: (...a: unknown[]) => mockQueryRawUnsafe(...a),
  },
}));

import { mergeWithRRF, mergeWithWeightedRRF, getSemanticallySimilarUsers } from '../semantic-search.service.js';

const VEC = new Array(1536).fill(0.1);

// ── mergeWithRRF (equal weights, legacy API) ──────────────────────────────────

describe('mergeWithRRF()', () => {
  it('returns union of both lists sorted by RRF score', () => {
    const score    = ['a', 'b', 'c'];
    const semantic = ['b', 'c', 'd'];
    const result   = mergeWithRRF(score, semantic);
    // b and c appear in both lists → higher score → first
    expect(result.indexOf('b')).toBeLessThan(result.indexOf('d'));
    expect(result).toHaveLength(4);
  });

  it('is stable when one list is empty', () => {
    expect(mergeWithRRF(['a', 'b'], [])).toEqual(['a', 'b']);
    expect(mergeWithRRF([], ['x', 'y'])).toEqual(['x', 'y']);
  });

  it('higher-ranked items in both lists beat lower-ranked single-list items', () => {
    const result = mergeWithRRF(['a', 'b'], ['a', 'c']);
    expect(result[0]).toBe('a');
  });
});

// ── mergeWithWeightedRRF ──────────────────────────────────────────────────────

describe('mergeWithWeightedRRF()', () => {
  it('higher weight list dominates rank ordering', () => {
    const personalityRanked = ['x', 'y'];
    const storyRanked       = ['y', 'z'];
    // personality weight 0.5, story weight 0.25 → y appears in both; x only high in personality
    const result = mergeWithWeightedRRF([personalityRanked, storyRanked], [0.5, 0.25]);
    expect(result).toContain('x');
    expect(result).toContain('y');
    expect(result).toContain('z');
    expect(result).toHaveLength(3);
  });

  it('defaults to equal weights when weights array omitted', () => {
    const r1 = mergeWithWeightedRRF([['a', 'b'], ['b', 'c']]);
    const r2 = mergeWithRRF(['a', 'b'], ['b', 'c']);
    expect(r1).toEqual(r2);
  });

  it('handles 3 lists', () => {
    const lists = [['a', 'b'], ['b', 'c'], ['c', 'd']];
    const result = mergeWithWeightedRRF(lists, [0.5, 0.25, 0.25]);
    expect(result).toHaveLength(4);
    expect(result[0]).toBe('b'); // b in lists 0+1; c in lists 1+2; b wins on weight (list 0 is 0.5)
  });

  it('returns empty array for empty input', () => {
    expect(mergeWithWeightedRRF([])).toEqual([]);
    expect(mergeWithWeightedRRF([[]])).toEqual([]);
  });
});

// ── getSemanticallySimilarUsers ───────────────────────────────────────────────

describe('getSemanticallySimilarUsers()', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns [] when user has no embedding', async () => {
    mockQueryRaw.mockResolvedValueOnce([]);         // fetchUserVectors returns empty
    const result = await getSemanticallySimilarUsers('user-1', 10, []);
    expect(result).toEqual([]);
  });

  it('uses single-vector path when only personality embedding exists', async () => {
    // fetchUserVectors returns row with only personality embedding
    mockQueryRaw.mockResolvedValueOnce([{
      embedding: VEC, storyEmbedding: null, habitsEmbedding: null,
    }]);
    // annByColumn result
    mockQueryRawUnsafe.mockResolvedValueOnce([{ user_id: 'user-2' }, { user_id: 'user-3' }]);

    const result = await getSemanticallySimilarUsers('user-1', 10, []);
    expect(result).toEqual(['user-2', 'user-3']);
    expect(mockQueryRawUnsafe).toHaveBeenCalledTimes(1);
  });

  it('uses 3-vector path and calls annByColumn 3 times when all embeddings present (Phase C)', async () => {
    mockQueryRaw.mockResolvedValueOnce([{
      embedding: VEC, storyEmbedding: VEC, habitsEmbedding: VEC,
    }]);
    // Three ANN calls return different ordered lists
    mockQueryRawUnsafe
      .mockResolvedValueOnce([{ user_id: 'p1' }, { user_id: 'p2' }])
      .mockResolvedValueOnce([{ user_id: 'p2' }, { user_id: 'p3' }])
      .mockResolvedValueOnce([{ user_id: 'p3' }, { user_id: 'p4' }]);

    const result = await getSemanticallySimilarUsers('user-1', 10, []);
    expect(mockQueryRawUnsafe).toHaveBeenCalledTimes(3);
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain('p1');
    expect(result).toContain('p4');
  });

  it('excludes the querying user from results', async () => {
    mockQueryRaw.mockResolvedValueOnce([{
      embedding: VEC, storyEmbedding: null, habitsEmbedding: null,
    }]);
    mockQueryRawUnsafe.mockResolvedValueOnce([{ user_id: 'user-2' }]);

    await getSemanticallySimilarUsers('user-1', 10, []);
    const call = mockQueryRawUnsafe.mock.calls[0];
    // First arg to $queryRawUnsafe is the SQL string; second is the exclude array
    expect(call[1]).toContain('user-1');
  });
});
