/**
 * AI-002 tests — Profile Intelligence Service.
 * Mocks OpenAI client, DB, and config.
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
const mockChatCreate = jest.fn();
const mockEmbeddingsCreate = jest.fn();

jest.mock('../client.js', () => ({
  isAiConfigured: jest.fn(() => true),
  getAiClient: jest.fn(() => ({
    chat: { completions: { create: mockChatCreate } },
    embeddings: { create: mockEmbeddingsCreate },
  })),
  AiNotConfiguredError: class AiNotConfiguredError extends Error {},
  _resetAiClient: jest.fn(),
}));

// ── DB mock ───────────────────────────────────────────────────────────────────
const mockUserFindUnique = jest.fn();
const mockEmbeddingUpsert = jest.fn();

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
    profileEmbedding: { upsert: (...a: unknown[]) => mockEmbeddingUpsert(...a) },
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
  realLifeAnswers: [{ questionKey: 'DIET_AND_LIFESTYLE', value: 'vegetarian' }],
  storyPromptAnswers: [{ promptKey: 'LIFE_GOALS', answer: 'I want to build a company...' }],
  habitLogs: [{ id: 'h1' }],
  groupMemberships: [{ group: { name: 'UK Gujaratis' } }],
  eventRsvps: [{ id: 'rsvp-1' }],
  promptResponses: [{ id: 'pr-1' }],
};

const MOCK_GPT_RESPONSE = {
  summary: 'Priya is a warm, career-driven Gujarati professional based in London.',
  traitTags: ['family-oriented', 'career-driven', 'health-conscious', 'adventurous', 'open-minded', 'culturally-rooted', 'socially-active', 'compassionate'],
  vibeScores: { warmth: 8, ambition: 9, tradition: 6, socialEnergy: 7, openness: 8 },
  compatibilityNotes: 'Priya connects well with ambitious professionals.',
  recommendedContactWindow: { startHour: 8, endHour: 22, timezone: 'Europe/London' },
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUserFindUnique.mockResolvedValue(MOCK_USER);
  mockChatCreate.mockResolvedValue({
    choices: [{ message: { content: JSON.stringify(MOCK_GPT_RESPONSE) } }],
  });
  mockEmbeddingsCreate.mockResolvedValue({
    data: [{ embedding: new Array(1536).fill(0.1) }],
  });
  mockEmbeddingUpsert.mockResolvedValue({});
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

  it('calls GPT with profile data', async () => {
    await generateProfileIntelligence('user-aaa');
    expect(mockChatCreate).toHaveBeenCalledTimes(1);
    const [call] = mockChatCreate.mock.calls;
    expect(call[0].model).toBe('gpt-4o-mini');
    expect(call[0].response_format).toEqual({ type: 'json_object' });
  });

  it('calls embeddings API with summary text', async () => {
    await generateProfileIntelligence('user-aaa');
    expect(mockEmbeddingsCreate).toHaveBeenCalledTimes(1);
    const [call] = mockEmbeddingsCreate.mock.calls;
    expect(call[0].model).toBe('text-embedding-3-small');
    expect(call[0].input).toBe(MOCK_GPT_RESPONSE.summary);
  });

  it('upserts ProfileEmbedding in DB', async () => {
    await generateProfileIntelligence('user-aaa');
    expect(mockEmbeddingUpsert).toHaveBeenCalledTimes(1);
    const [call] = mockEmbeddingUpsert.mock.calls;
    expect(call[0].where).toEqual({ userId: 'user-aaa' });
    expect(call[0].create.traitTags).toHaveLength(8);
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
          content: JSON.stringify({
            summary: 'Minimal response',
            traitTags: ['family-oriented'],
          }),
        },
      }],
    });
    const result = await generateProfileIntelligence('user-aaa');
    expect(result!.vibeScores.warmth).toBe(5);
  });
});
