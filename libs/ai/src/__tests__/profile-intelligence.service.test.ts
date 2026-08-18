/**
 * AI-002 tests — Profile Intelligence Service.
 * Phase C: 3 embedding vectors (personality, story, habits) + $executeRaw for vector persistence.
 */

// ── Env mock ──────────────────────────────────────────────────────────────────
const mockEnv = {
  OPENAI_API_KEY: 'sk-test',
  AI_MODEL: 'gpt-4o-mini',
  EMBEDDING_MODEL: 'text-embedding-3-small',
  REDIS_URL: 'redis://localhost:6379',
};

jest.mock('@abroad-matrimony/config', () => ({ getEnv: () => mockEnv }));
jest.mock('@abroad-matrimony/logger', () => ({
  createChildLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

// ── OpenAI mock ───────────────────────────────────────────────────────────────
const mockChatCreate       = jest.fn();
const mockEmbeddingsCreate = jest.fn();

jest.mock('../client.js', () => ({
  isAiConfigured:     jest.fn(() => true),
  getAiClient:        jest.fn(() => ({
    chat:       { completions: { create: mockChatCreate } },
    embeddings: { create: mockEmbeddingsCreate },
  })),
  AiNotConfiguredError: class AiNotConfiguredError extends Error {},
  _resetAiClient:     jest.fn(),
}));

// ── DB mock ───────────────────────────────────────────────────────────────────
const mockUserFindUnique   = jest.fn();
const mockEmbeddingUpsert  = jest.fn();
const mockExecuteRaw       = jest.fn();

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    user:             { findUnique:  (...a: unknown[]) => mockUserFindUnique(...a) },
    profileEmbedding: { upsert:      (...a: unknown[]) => mockEmbeddingUpsert(...a) },
    $executeRaw:      (...a: unknown[]) => mockExecuteRaw(...a),
  },
}));

import { generateProfileIntelligence } from '../profile-intelligence.service.js';
import { isAiConfigured } from '../client.js';

const MOCK_USER = {
  id: 'user-aaa',
  profile: {
    name: 'Priya Sharma',
    dateOfBirth: new Date('1995-06-15'),
    gender: 'FEMALE',
    currentCountry: 'United Kingdom',
    currentCity: 'London',
    bio: 'Software engineer who loves travel',
    voiceIntroTranscript: null,
  },
  realLifeAnswers:    [{ questionKey: 'DIET_AND_LIFESTYLE', value: 'vegetarian' }],
  storyPromptAnswers: [{ promptKey: 'LIFE_GOALS', answer: 'I want to build a company...' }],
  habitLogs:          [{ habitKey: 'EXERCISE' }],
  groupMemberships:   [{ group: { name: 'UK Gujaratis' } }],
  eventRsvps:         [{ id: 'rsvp-1' }],
  promptResponses:    [{ id: 'pr-1' }],
};

const MOCK_GPT_RESPONSE = {
  summary: 'Priya is a warm, career-driven Gujarati professional based in London.',
  traitTags: ['family-oriented', 'career-driven', 'health-conscious', 'adventurous', 'open-minded', 'culturally-rooted', 'socially-active', 'compassionate'],
  vibeScores: { warmth: 8, ambition: 9, tradition: 6, socialEnergy: 7, openness: 8 },
  compatibilityNotes: 'Priya connects well with ambitious professionals.',
  recommendedContactWindow: { startHour: 8, endHour: 22, timezone: 'Europe/London' },
};

const MOCK_VECTOR = new Array(1536).fill(0.1);

function setHappyPath() {
  mockUserFindUnique.mockResolvedValue(MOCK_USER);
  mockChatCreate.mockResolvedValue({
    choices: [{ message: { content: JSON.stringify(MOCK_GPT_RESPONSE) } }],
  });
  // Phase C: embeddings.create called 3 times (personality, story, habits)
  mockEmbeddingsCreate.mockResolvedValue({ data: [{ embedding: MOCK_VECTOR }] });
  mockEmbeddingUpsert.mockResolvedValue({});
  mockExecuteRaw.mockResolvedValue(1);
}

beforeEach(() => {
  jest.clearAllMocks();
  setHappyPath();
});

// ── Happy path ────────────────────────────────────────────────────────────────
describe('generateProfileIntelligence()', () => {
  it('returns ProfileEmbeddingDto with all fields on success', async () => {
    const result = await generateProfileIntelligence('user-aaa');

    expect(result).not.toBeNull();
    expect(result!.userId).toBe('user-aaa');
    expect(result!.summary).toBe(MOCK_GPT_RESPONSE.summary);
    expect(result!.traitTags).toHaveLength(8);
    expect(result!.vibeScores.warmth).toBe(8);
    expect(result!.embedding).toHaveLength(1536);
    expect(result!.recommendedContactWindow.timezone).toBe('Europe/London');
  });

  it('calls GPT exactly once with profile data', async () => {
    await generateProfileIntelligence('user-aaa');
    expect(mockChatCreate).toHaveBeenCalledTimes(1);
    const [call] = mockChatCreate.mock.calls;
    expect(call[0].model).toBe('gpt-4o-mini');
    expect(call[0].response_format).toEqual({ type: 'json_object' });
  });

  it('calls embeddings API 3 times (Phase C: personality + story + habits)', async () => {
    await generateProfileIntelligence('user-aaa');
    expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(3);
    // First call uses the AI summary (personality embedding)
    expect(mockEmbeddingsCreate.mock.calls[0][0].input).toBe(MOCK_GPT_RESPONSE.summary);
  });

  it('upserts ProfileEmbedding metadata in DB', async () => {
    await generateProfileIntelligence('user-aaa');
    expect(mockEmbeddingUpsert).toHaveBeenCalledTimes(1);
    const [call] = mockEmbeddingUpsert.mock.calls;
    expect(call[0].where).toEqual({ userId: 'user-aaa' });
    expect(call[0].create.traitTags).toHaveLength(8);
  });

  it('calls $executeRaw to save vectors after upsert (Phase C)', async () => {
    await generateProfileIntelligence('user-aaa');
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1);
  });

  it('uses story prompt text as input for story embedding (Phase C)', async () => {
    await generateProfileIntelligence('user-aaa');
    // Second call is story embedding — should contain story answer
    const storyCall = mockEmbeddingsCreate.mock.calls[1][0];
    expect(storyCall.input).toContain('LIFE_GOALS');
    expect(storyCall.input).toContain('I want to build a company');
  });

  it('uses habits text as input for habits embedding (Phase C)', async () => {
    await generateProfileIntelligence('user-aaa');
    const habitsCall = mockEmbeddingsCreate.mock.calls[2][0];
    expect(habitsCall.input).toContain('EXERCISE');
  });

  it('returns null when AI is not configured', async () => {
    (isAiConfigured as jest.Mock).mockReturnValueOnce(false);
    const result = await generateProfileIntelligence('user-aaa');
    expect(result).toBeNull();
    expect(mockChatCreate).not.toHaveBeenCalled();
  });

  it('returns null when profile is not found', async () => {
    mockUserFindUnique.mockResolvedValueOnce(null);
    const result = await generateProfileIntelligence('user-aaa');
    expect(result).toBeNull();
    expect(mockChatCreate).not.toHaveBeenCalled();
  });

  it('returns null when GPT returns invalid JSON', async () => {
    mockChatCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'not-json' } }],
    });
    const result = await generateProfileIntelligence('user-aaa');
    expect(result).toBeNull();
  });

  it('uses default vibeScores when GPT omits them', async () => {
    mockChatCreate.mockResolvedValueOnce({
      choices: [{
        message: {
          content: JSON.stringify({ summary: 'Minimal response', traitTags: ['family-oriented'] }),
        },
      }],
    });
    const result = await generateProfileIntelligence('user-aaa');
    expect(result!.vibeScores.warmth).toBe(5);
  });
});
