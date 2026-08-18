/**
 * VEC-002 tests — Group Intelligence Service.
 * Mocks OpenAI client, DB raw queries.
 */

// ── Env mock ──────────────────────────────────────────────────────────────────
jest.mock('@abroad-matrimony/config', () => ({ getEnv: () => ({ OPENAI_API_KEY: 'sk-test' }) }));
jest.mock('@abroad-matrimony/logger', () => ({
  createChildLogger: () => ({ info: jest.fn(), warn: jest.fn(), debug: jest.fn() }),
}));

// ── OpenAI mock ───────────────────────────────────────────────────────────────
const mockEmbeddingsCreate = jest.fn();

jest.mock('../client.js', () => ({
  isAiConfigured: jest.fn(() => true),
  getAiClient:    jest.fn(() => ({ embeddings: { create: mockEmbeddingsCreate } })),
}));

// ── DB mock ───────────────────────────────────────────────────────────────────
const mockGroupFindUnique = jest.fn();
const mockExecuteRaw      = jest.fn();
const mockQueryRaw        = jest.fn();

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    group:       { findUnique: (...a: unknown[]) => mockGroupFindUnique(...a) },
    $executeRaw: (...a: unknown[]) => mockExecuteRaw(...a),
    $queryRaw:   (...a: unknown[]) => mockQueryRaw(...a),
  },
}));

// ── Import after mocks ────────────────────────────────────────────────────────
import {
  generateGroupEmbedding,
  generateAllGroupEmbeddings,
  GroupNotFoundError,
} from '../group-intelligence.service.js';
import { isAiConfigured } from '../client.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────
const MOCK_GROUP = {
  id:           'group-1',
  name:         'UK Gujarati Community',
  type:         'CULTURAL',
  region:       'Europe',
  country:      'United Kingdom',
  description:  'A community for Gujarati professionals in the UK.',
  professionTag: null,
  culturalTag:  'Gujarati',
};

const MOCK_EMBEDDING = Array(1536).fill(0.1);

const MOCK_EMBED_ROW = [{ group_id: 'group-1', summary: 'Group: UK Gujarati Community. Type: CULTURAL.', updated_at: new Date('2026-07-27') }];

function setupSuccess() {
  mockGroupFindUnique.mockResolvedValue(MOCK_GROUP);
  mockEmbeddingsCreate.mockResolvedValue({ data: [{ embedding: MOCK_EMBEDDING }] });
  mockExecuteRaw.mockResolvedValue(1);
  mockQueryRaw.mockResolvedValue(MOCK_EMBED_ROW); // read-back after upsert
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('generateGroupEmbedding', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns null and does nothing when AI is not configured', async () => {
    (isAiConfigured as jest.Mock).mockReturnValueOnce(false);
    const result = await generateGroupEmbedding('group-1');
    expect(result).toBeNull();
    expect(mockGroupFindUnique).not.toHaveBeenCalled();
  });

  it('throws GroupNotFoundError when group does not exist', async () => {
    mockGroupFindUnique.mockResolvedValue(null);
    await expect(generateGroupEmbedding('missing')).rejects.toBeInstanceOf(GroupNotFoundError);
  });

  it('returns null when embedding API returns empty data', async () => {
    mockGroupFindUnique.mockResolvedValue(MOCK_GROUP);
    mockEmbeddingsCreate.mockResolvedValue({ data: [] });
    const result = await generateGroupEmbedding('group-1');
    expect(result).toBeNull();
  });

  it('upserts embedding and returns DTO on success', async () => {
    setupSuccess();
    const result = await generateGroupEmbedding('group-1');
    expect(mockEmbeddingsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'text-embedding-3-small' }),
    );
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ groupId: 'group-1' });
    expect(typeof result!.summary).toBe('string');
  });

  it('builds text including description and cultural tag', async () => {
    setupSuccess();
    await generateGroupEmbedding('group-1');
    const [embeddingCall] = mockEmbeddingsCreate.mock.calls as Array<[{ input: string }]>;
    expect(embeddingCall[0].input).toContain('UK Gujarati Community');
    expect(embeddingCall[0].input).toContain('CULTURAL');
    expect(embeddingCall[0].input).toContain('Gujarati');
  });

  it('includes professionTag in text when present', async () => {
    mockGroupFindUnique.mockResolvedValue({ ...MOCK_GROUP, professionTag: 'Finance', culturalTag: null });
    mockEmbeddingsCreate.mockResolvedValue({ data: [{ embedding: MOCK_EMBEDDING }] });
    mockExecuteRaw.mockResolvedValue(1);
    mockQueryRaw.mockResolvedValue([{ group_id: 'group-1', summary: 'Finance group', updated_at: new Date() }]);

    await generateGroupEmbedding('group-1');
    const [embeddingCall] = mockEmbeddingsCreate.mock.calls as Array<[{ input: string }]>;
    expect(embeddingCall[0].input).toContain('Finance');
  });

  it('omits region country suffix when country is null', async () => {
    mockGroupFindUnique.mockResolvedValue({ ...MOCK_GROUP, country: null });
    mockEmbeddingsCreate.mockResolvedValue({ data: [{ embedding: MOCK_EMBEDDING }] });
    mockExecuteRaw.mockResolvedValue(1);
    mockQueryRaw.mockResolvedValue([{ group_id: 'group-1', summary: 'Regional', updated_at: new Date() }]);

    await generateGroupEmbedding('group-1');
    const [embeddingCall] = mockEmbeddingsCreate.mock.calls as Array<[{ input: string }]>;
    expect(embeddingCall[0].input).toContain('Europe');
    expect(embeddingCall[0].input).not.toContain('(undefined)');
  });
});

describe('generateAllGroupEmbeddings', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns zeros and does nothing when AI is not configured', async () => {
    (isAiConfigured as jest.Mock).mockReturnValueOnce(false);
    const result = await generateAllGroupEmbeddings();
    expect(result).toEqual({ processed: 0, skipped: 0, errors: 0 });
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it('processes all stale groups returned by the raw query', async () => {
    const readBackRow = { group_id: 'g1', summary: 'x', updated_at: new Date() };
    // First call: stale-groups list; subsequent calls: read-back after each upsert
    mockQueryRaw
      .mockResolvedValueOnce([{ id: 'g1' }, { id: 'g2' }])
      .mockResolvedValue([readBackRow]);
    mockGroupFindUnique.mockResolvedValue(MOCK_GROUP);
    mockEmbeddingsCreate.mockResolvedValue({ data: [{ embedding: MOCK_EMBEDDING }] });
    mockExecuteRaw.mockResolvedValue(1);

    const result = await generateAllGroupEmbeddings();
    expect(result.processed).toBe(2);
    expect(result.errors).toBe(0);
  });

  it('counts errors for failed groups without throwing', async () => {
    const readBackRow = { group_id: 'g1', summary: 'x', updated_at: new Date() };
    mockQueryRaw
      .mockResolvedValueOnce([{ id: 'g1' }, { id: 'g2' }])
      .mockResolvedValue([readBackRow]);
    mockGroupFindUnique
      .mockResolvedValueOnce(MOCK_GROUP)
      .mockResolvedValueOnce(null); // second group not found → error
    mockEmbeddingsCreate.mockResolvedValue({ data: [{ embedding: MOCK_EMBEDDING }] });
    mockExecuteRaw.mockResolvedValue(1);

    const result = await generateAllGroupEmbeddings();
    expect(result.processed).toBe(1);
    expect(result.errors).toBe(1);
  });

  it('returns empty result when no stale groups found', async () => {
    mockQueryRaw.mockResolvedValue([]);
    const result = await generateAllGroupEmbeddings();
    expect(result).toEqual({ processed: 0, skipped: 0, errors: 0 });
  });
});
