import {
  getCurrentPrompt,
  respondToPrompt,
  getPromptResponses,
  resonateResponse,
  unresonateResponse,
  PromptNotFoundError,
  PromptResponseNotFoundError,
  AlreadyRespondedError,
  AlreadyResonatedError,
  ResonateNotFoundError,
} from '../index.js';
import { PromptResponseType } from '@abroad-matrimony/shared';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockWeeklyPromptFindUnique = jest.fn();
const mockPromptResponseFindUnique = jest.fn();
const mockPromptResponseCreate   = jest.fn();
const mockPromptResponseFindMany = jest.fn();
const mockPromptResponseCount    = jest.fn();
const mockPromptResponseUpdate   = jest.fn();
const mockPromptResonateFindUnique = jest.fn();
const mockPromptResonateCreate   = jest.fn();
const mockPromptResonateDelete   = jest.fn();
const mockPromptResonateFindMany = jest.fn();
const mockUserFindUnique         = jest.fn();
const mockTransaction            = jest.fn();

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    weeklyPrompt: {
      findUnique: (...a: unknown[]) => mockWeeklyPromptFindUnique(...a),
    },
    promptResponse: {
      findUnique: (...a: unknown[]) => mockPromptResponseFindUnique(...a),
      create:     (...a: unknown[]) => mockPromptResponseCreate(...a),
      findMany:   (...a: unknown[]) => mockPromptResponseFindMany(...a),
      count:      (...a: unknown[]) => mockPromptResponseCount(...a),
      update:     (...a: unknown[]) => mockPromptResponseUpdate(...a),
    },
    promptResonate: {
      findUnique: (...a: unknown[]) => mockPromptResonateFindUnique(...a),
      create:     (...a: unknown[]) => mockPromptResonateCreate(...a),
      delete:     (...a: unknown[]) => mockPromptResonateDelete(...a),
      findMany:   (...a: unknown[]) => mockPromptResonateFindMany(...a),
    },
    user: {
      findUnique: (...a: unknown[]) => mockUserFindUnique(...a),
    },
    $transaction: (...a: unknown[]) => mockTransaction(...a),
  },
}));

// The prompts lib imports getWeekKey from @abroad-matrimony/introductions
jest.mock('@abroad-matrimony/introductions', () => ({
  getWeekKey: () => '2026-W22',
}));

// ── Fixtures ───────────────────────────────────────────────────────────────────

const USER_ID    = 'user-uuid-1';
const PROMPT_ID  = 'prompt-uuid-1';
const RESPONSE_ID = 'response-uuid-1';

const FUTURE_DATE = new Date(Date.now() + 7 * 86400000);
const PAST_DATE   = new Date(Date.now() - 1000);

const PROMPT_ROW = {
  id: PROMPT_ID,
  weekKey: '2026-W22',
  question: 'What does home mean to you?',
  theme: 'Connection',
  publishedAt: new Date('2026-05-26T00:00:00Z'),
  expiresAt: FUTURE_DATE,
  _count: { responses: 0 },
};

const RESPONSE_ROW = {
  id: RESPONSE_ID,
  userId: USER_ID,
  promptId: PROMPT_ID,
  text: 'Home is where family is.',
  type: PromptResponseType.TEXT,
  mediaUrl: null,
  resonateCount: 0,
  createdAt: new Date('2026-05-27T10:00:00Z'),
};

// ── getCurrentPrompt ───────────────────────────────────────────────────────────

describe('getCurrentPrompt', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns the current week\'s prompt with hasResponded=false', async () => {
    mockWeeklyPromptFindUnique.mockResolvedValue(PROMPT_ROW);

    const result = await getCurrentPrompt(USER_ID);

    expect(result).not.toBeNull();
    expect(result!.question).toBe('What does home mean to you?');
    expect(result!.hasResponded).toBe(false);
  });

  it('returns hasResponded=true when user has responded', async () => {
    mockWeeklyPromptFindUnique.mockResolvedValue({ ...PROMPT_ROW, _count: { responses: 1 } });

    const result = await getCurrentPrompt(USER_ID);
    expect(result!.hasResponded).toBe(true);
  });

  it('returns null when no prompt for this week', async () => {
    mockWeeklyPromptFindUnique.mockResolvedValue(null);

    const result = await getCurrentPrompt(USER_ID);
    expect(result).toBeNull();
  });
});

// ── respondToPrompt ────────────────────────────────────────────────────────────

describe('respondToPrompt', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a response to the prompt', async () => {
    mockWeeklyPromptFindUnique.mockResolvedValue({ id: PROMPT_ID, expiresAt: FUTURE_DATE });
    mockPromptResponseFindUnique.mockResolvedValue(null);
    mockUserFindUnique.mockResolvedValue({ profile: { name: 'Rahul' } });
    mockPromptResponseCreate.mockResolvedValue(RESPONSE_ROW);

    const result = await respondToPrompt(USER_ID, PROMPT_ID, 'Home is where family is.');

    expect(mockPromptResponseCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: USER_ID,
          promptId: PROMPT_ID,
          text: 'Home is where family is.',
        }),
      }),
    );
    expect(result.text).toBe('Home is where family is.');
    expect(result.hasResonated).toBe(false);
    expect(result.authorName).toBe('Rahul');
  });

  it('throws PromptNotFoundError when prompt does not exist', async () => {
    mockWeeklyPromptFindUnique.mockResolvedValue(null);

    await expect(respondToPrompt(USER_ID, PROMPT_ID, 'text')).rejects.toBeInstanceOf(
      PromptNotFoundError,
    );
  });

  it('throws PromptNotFoundError when prompt has expired', async () => {
    mockWeeklyPromptFindUnique.mockResolvedValue({ id: PROMPT_ID, expiresAt: PAST_DATE });

    await expect(respondToPrompt(USER_ID, PROMPT_ID, 'text')).rejects.toBeInstanceOf(
      PromptNotFoundError,
    );
  });

  it('throws AlreadyRespondedError when user has already responded', async () => {
    mockWeeklyPromptFindUnique.mockResolvedValue({ id: PROMPT_ID, expiresAt: FUTURE_DATE });
    mockPromptResponseFindUnique.mockResolvedValue({ id: RESPONSE_ID });

    await expect(respondToPrompt(USER_ID, PROMPT_ID, 'text')).rejects.toBeInstanceOf(
      AlreadyRespondedError,
    );
  });
});

// ── getPromptResponses ─────────────────────────────────────────────────────────

describe('getPromptResponses', () => {
  beforeEach(() => jest.clearAllMocks());

  const responseRows = [
    {
      ...RESPONSE_ROW,
      user: { profile: { name: 'Rahul' } },
    },
  ];

  it('returns paginated responses with hasResonated for each', async () => {
    mockWeeklyPromptFindUnique.mockResolvedValue({ id: PROMPT_ID });
    mockTransaction.mockImplementation(async (queries: Promise<unknown>[]) => {
      return await Promise.all(queries);
    });
    mockPromptResponseFindMany.mockResolvedValue(responseRows);
    mockPromptResponseCount.mockResolvedValue(1);
    mockPromptResonateFindMany.mockResolvedValue([]);

    const result = await getPromptResponses(USER_ID, PROMPT_ID, 1, 10);

    expect(result.total).toBe(1);
    expect(result.responses).toHaveLength(1);
    expect(result.responses[0].hasResonated).toBe(false);
    expect(result.responses[0].authorName).toBe('Rahul');
  });

  it('marks hasResonated=true when user has resonated', async () => {
    mockWeeklyPromptFindUnique.mockResolvedValue({ id: PROMPT_ID });
    mockTransaction.mockImplementation(async (queries: Promise<unknown>[]) => {
      return await Promise.all(queries);
    });
    mockPromptResponseFindMany.mockResolvedValue(responseRows);
    mockPromptResponseCount.mockResolvedValue(1);
    mockPromptResonateFindMany.mockResolvedValue([{ responseId: RESPONSE_ID }]);

    const result = await getPromptResponses(USER_ID, PROMPT_ID, 1, 10);
    expect(result.responses[0].hasResonated).toBe(true);
  });

  it('throws PromptNotFoundError when prompt does not exist', async () => {
    mockWeeklyPromptFindUnique.mockResolvedValue(null);
    await expect(getPromptResponses(USER_ID, PROMPT_ID, 1, 10)).rejects.toBeInstanceOf(
      PromptNotFoundError,
    );
  });
});

// ── resonateResponse ───────────────────────────────────────────────────────────

describe('resonateResponse', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates resonate and increments count', async () => {
    mockPromptResponseFindUnique.mockResolvedValue({ id: RESPONSE_ID });
    mockPromptResonateFindUnique.mockResolvedValue(null);
    mockTransaction.mockImplementation(async (queries: Promise<unknown>[]) => {
      return await Promise.all(queries);
    });
    mockPromptResonateCreate.mockResolvedValue({});
    mockPromptResponseUpdate.mockResolvedValue({});

    await resonateResponse(USER_ID, RESPONSE_ID);

    expect(mockTransaction).toHaveBeenCalled();
  });

  it('throws PromptResponseNotFoundError when response does not exist', async () => {
    mockPromptResponseFindUnique.mockResolvedValue(null);
    await expect(resonateResponse(USER_ID, RESPONSE_ID)).rejects.toBeInstanceOf(
      PromptResponseNotFoundError,
    );
  });

  it('throws AlreadyResonatedError when already resonated', async () => {
    mockPromptResponseFindUnique.mockResolvedValue({ id: RESPONSE_ID });
    mockPromptResonateFindUnique.mockResolvedValue({ id: 'resonate-1' });

    await expect(resonateResponse(USER_ID, RESPONSE_ID)).rejects.toBeInstanceOf(
      AlreadyResonatedError,
    );
  });
});

// ── unresonateResponse ─────────────────────────────────────────────────────────

describe('unresonateResponse', () => {
  beforeEach(() => jest.clearAllMocks());

  it('deletes resonate and decrements count', async () => {
    mockPromptResponseFindUnique.mockResolvedValue({ id: RESPONSE_ID });
    mockPromptResonateFindUnique.mockResolvedValue({ id: 'resonate-1' });
    mockTransaction.mockImplementation(async (queries: Promise<unknown>[]) => {
      return await Promise.all(queries);
    });
    mockPromptResonateDelete.mockResolvedValue({});
    mockPromptResponseUpdate.mockResolvedValue({});

    await unresonateResponse(USER_ID, RESPONSE_ID);

    expect(mockTransaction).toHaveBeenCalled();
  });

  it('throws PromptResponseNotFoundError when response does not exist', async () => {
    mockPromptResponseFindUnique.mockResolvedValue(null);
    await expect(unresonateResponse(USER_ID, RESPONSE_ID)).rejects.toBeInstanceOf(
      PromptResponseNotFoundError,
    );
  });

  it('throws ResonateNotFoundError when user has not resonated', async () => {
    mockPromptResponseFindUnique.mockResolvedValue({ id: RESPONSE_ID });
    mockPromptResonateFindUnique.mockResolvedValue(null);

    await expect(unresonateResponse(USER_ID, RESPONSE_ID)).rejects.toBeInstanceOf(
      ResonateNotFoundError,
    );
  });
});
