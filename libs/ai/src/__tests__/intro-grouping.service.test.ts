/**
 * AI-004 tests — Intro Drop Proposal Service.
 */

// ── Env mock ──────────────────────────────────────────────────────────────────
const mockEnv = {
  OPENAI_API_KEY: 'sk-test',
  AI_MODEL: 'gpt-4o-mini',
};

jest.mock('@abroad-matrimony/config', () => ({ getEnv: () => mockEnv }));
jest.mock('@abroad-matrimony/logger', () => ({
  createChildLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));

// ── AI client mock ────────────────────────────────────────────────────────────
const mockChatCreate = jest.fn();
jest.mock('../client.js', () => ({
  isAiConfigured: jest.fn(() => true),
  getAiClient: jest.fn(() => ({
    chat: { completions: { create: mockChatCreate } },
  })),
  AiNotConfiguredError: class AiNotConfiguredError extends Error {},
}));

// ── DB mock ───────────────────────────────────────────────────────────────────
const mockUserFindMany = jest.fn();
const mockDropCreate = jest.fn();

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    user: { findMany: (...a: unknown[]) => mockUserFindMany(...a) },
    introductionDrop: { create: (...a: unknown[]) => mockDropCreate(...a) },
  },
}));

import { proposeIntroductionDrops } from '../intro-grouping.service.js';
import { isAiConfigured } from '../client.js';

function makeUsers(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `user-${String(i).padStart(4, '0')}`,
    profile: {
      gender: i % 2 === 0 ? 'MALE' : 'FEMALE',
      dateOfBirth: new Date('1994-01-01'),
    },
    profileEmbedding: { summary: `User ${i} summary`, traitTags: ['family-oriented', 'adventurous'] },
    introductionsAsA: [],
  }));
}

const MOCK_GPT_GROUPS = [
  {
    name: 'Gujarati Professionals UK',
    rationale: 'Shared cultural and professional background',
    memberIds: ['user-0000', 'user-0001', 'user-0002', 'user-0003', 'user-0004'],
    releaseRecommendation: '2026-06-05T10:00:00.000Z',
  },
  {
    name: 'Tamil Engineers Germany',
    rationale: 'Tech professionals in Germany',
    memberIds: ['user-0005', 'user-0006', 'user-0007', 'user-0008'],
    releaseRecommendation: '2026-06-06T10:00:00.000Z',
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockUserFindMany.mockResolvedValue(makeUsers(20));
  mockChatCreate.mockResolvedValue({
    choices: [{ message: { content: JSON.stringify(MOCK_GPT_GROUPS) } }],
  });
  mockDropCreate.mockResolvedValue({ id: 'drop-001' });
});

describe('proposeIntroductionDrops()', () => {
  it('returns draft DTOs for each proposed group', async () => {
    const result = await proposeIntroductionDrops('United Kingdom');
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Gujarati Professionals UK');
    expect(result[0].region).toBe('United Kingdom');
    expect(result[0].memberIds).toHaveLength(5);
  });

  it('creates IntroductionDrop records with DRAFT status', async () => {
    await proposeIntroductionDrops('United Kingdom');
    expect(mockDropCreate).toHaveBeenCalledTimes(2);
    const [call] = mockDropCreate.mock.calls;
    expect(call[0].data.status).toBe('DRAFT');
    expect(call[0].data.proposedByAI).toBe(true);
  });

  it('returns empty array when AI is not configured', async () => {
    (isAiConfigured as jest.Mock).mockReturnValueOnce(false);
    const result = await proposeIntroductionDrops('United Kingdom');
    expect(result).toHaveLength(0);
    expect(mockChatCreate).not.toHaveBeenCalled();
  });

  it('returns empty array when not enough eligible profiles', async () => {
    mockUserFindMany.mockResolvedValueOnce(makeUsers(5));
    const result = await proposeIntroductionDrops('United Kingdom');
    expect(result).toHaveLength(0);
    expect(mockChatCreate).not.toHaveBeenCalled();
  });

  it('skips groups with fewer than 2 memberIds', async () => {
    const gptsWithTooSmallGroup = [
      { name: 'Valid Group', rationale: 'good', memberIds: ['u1', 'u2', 'u3'], releaseRecommendation: '2026-06-05T10:00:00.000Z' },
      { name: 'Too Small', rationale: 'bad', memberIds: ['u4'], releaseRecommendation: '2026-06-06T10:00:00.000Z' },
    ];
    mockChatCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(gptsWithTooSmallGroup) } }],
    });
    const result = await proposeIntroductionDrops('United Kingdom');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Valid Group');
  });

  it('returns empty array when GPT returns invalid JSON', async () => {
    mockChatCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'bad json {{{' } }],
    });
    const result = await proposeIntroductionDrops('United Kingdom');
    expect(result).toHaveLength(0);
  });

  it('handles GPT response wrapped in a groups key', async () => {
    mockChatCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ groups: MOCK_GPT_GROUPS }) } }],
    });
    const result = await proposeIntroductionDrops('United Kingdom');
    expect(result).toHaveLength(2);
  });
});
