import {
  logProfileView,
  getWeeklyMetrics,
  getActionQueue,
  getMomentumData,
  ViewSelfError,
} from '../index.js';

// ── Prisma mocks ───────────────────────────────────────────────────────────────

const mockProfileViewFindFirst  = jest.fn();
const mockProfileViewCreate     = jest.fn();
const mockProfileViewCount      = jest.fn();
const mockConnectionCount       = jest.fn();
const mockConnectionFindMany    = jest.fn();
const mockPromptResonateCount   = jest.fn();
const mockIntroductionCount     = jest.fn();
const mockIntroductionFindMany  = jest.fn();
const mockProfileFindUnique     = jest.fn();

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    profileView: {
      findFirst: (...a: unknown[]) => mockProfileViewFindFirst(...a),
      create:    (...a: unknown[]) => mockProfileViewCreate(...a),
      count:     (...a: unknown[]) => mockProfileViewCount(...a),
    },
    connection: {
      count:    (...a: unknown[]) => mockConnectionCount(...a),
      findMany: (...a: unknown[]) => mockConnectionFindMany(...a),
    },
    promptResonate: {
      count: (...a: unknown[]) => mockPromptResonateCount(...a),
    },
    introduction: {
      count:    (...a: unknown[]) => mockIntroductionCount(...a),
      findMany: (...a: unknown[]) => mockIntroductionFindMany(...a),
    },
    profile: {
      findUnique: (...a: unknown[]) => mockProfileFindUnique(...a),
    },
  },
}));

// ── Fixtures ───────────────────────────────────────────────────────────────────

const USER_ID    = 'user-uuid-1';
const VIEWER_ID  = 'user-uuid-2';

// ── logProfileView ─────────────────────────────────────────────────────────────

describe('logProfileView', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a profile view record', async () => {
    mockProfileViewFindFirst.mockResolvedValue(null);
    mockProfileViewCreate.mockResolvedValue({});

    await logProfileView(VIEWER_ID, USER_ID);

    expect(mockProfileViewCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: { viewerId: VIEWER_ID, viewedId: USER_ID } }),
    );
  });

  it('deduplicates — no new record if same viewer viewed in last hour', async () => {
    mockProfileViewFindFirst.mockResolvedValue({ id: 'view-1' });

    await logProfileView(VIEWER_ID, USER_ID);

    expect(mockProfileViewCreate).not.toHaveBeenCalled();
  });

  it('throws ViewSelfError when viewer and viewed are the same', async () => {
    await expect(logProfileView(USER_ID, USER_ID)).rejects.toBeInstanceOf(ViewSelfError);
    expect(mockProfileViewFindFirst).not.toHaveBeenCalled();
  });
});

// ── getWeeklyMetrics ───────────────────────────────────────────────────────────

describe('getWeeklyMetrics', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 4 metrics with correct values and deltas', async () => {
    // views this week = 10, prev week = 6
    mockProfileViewCount
      .mockResolvedValueOnce(10) // this week
      .mockResolvedValueOnce(6); // prev week

    mockConnectionCount
      .mockResolvedValueOnce(3)  // this week
      .mockResolvedValueOnce(1); // prev week

    mockPromptResonateCount
      .mockResolvedValueOnce(5)  // this week
      .mockResolvedValueOnce(5); // prev week (no delta)

    mockIntroductionCount.mockResolvedValue(4);

    const result = await getWeeklyMetrics(USER_ID);

    expect(result.metrics).toHaveLength(4);
    expect(result.metrics[0]).toMatchObject({ key: 'profileViews',     value: 10, delta: 4 });
    expect(result.metrics[1]).toMatchObject({ key: 'connectionRequests', value: 3, delta: 2 });
    expect(result.metrics[2]).toMatchObject({ key: 'resonates',         value: 5,  delta: 0 });
    expect(result.metrics[3]).toMatchObject({ key: 'introPoolSize',     value: 4,  delta: 0 });
    expect(result.weekOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns zero deltas when no previous week data', async () => {
    mockProfileViewCount.mockResolvedValue(0);
    mockConnectionCount.mockResolvedValue(0);
    mockPromptResonateCount.mockResolvedValue(0);
    mockIntroductionCount.mockResolvedValue(0);

    const result = await getWeeklyMetrics(USER_ID);

    expect(result.metrics.every((m) => m.delta === 0)).toBe(true);
  });
});

// ── getActionQueue ─────────────────────────────────────────────────────────────

describe('getActionQueue', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns RESPOND_TO_INTRO items with priority 1', async () => {
    mockConnectionFindMany.mockResolvedValue([]);
    mockIntroductionFindMany.mockResolvedValue([
      { id: 'intro-1', userAId: USER_ID, userBId: 'other-uuid', drop: { releaseAt: new Date() } },
    ]);
    mockProfileFindUnique.mockResolvedValue({ completionScore: 90 });

    const queue = await getActionQueue(USER_ID);

    expect(queue[0].type).toBe('RESPOND_TO_INTRO');
    expect(queue[0].priority).toBe(1);
    expect(queue[0].targetUserId).toBe('other-uuid');
  });

  it('returns ACCEPT_CONNECTION items with priority 2', async () => {
    mockConnectionFindMany.mockResolvedValue([
      { id: 'conn-1', senderId: 'sender-uuid', sender: { profile: { name: 'Arjun' } } },
    ]);
    mockIntroductionFindMany.mockResolvedValue([]);
    mockProfileFindUnique.mockResolvedValue({ completionScore: 90 });

    const queue = await getActionQueue(USER_ID);

    expect(queue[0].type).toBe('ACCEPT_CONNECTION');
    expect(queue[0].label).toBe('Arjun wants to connect');
    expect(queue[0].targetUserId).toBe('sender-uuid');
  });

  it('returns COMPLETE_PROFILE when score is below threshold', async () => {
    mockConnectionFindMany.mockResolvedValue([]);
    mockIntroductionFindMany.mockResolvedValue([]);
    mockProfileFindUnique.mockResolvedValue({ completionScore: 60 });

    const queue = await getActionQueue(USER_ID);

    expect(queue.some((i) => i.type === 'COMPLETE_PROFILE')).toBe(true);
  });

  it('does not include COMPLETE_PROFILE when score is at or above threshold', async () => {
    mockConnectionFindMany.mockResolvedValue([]);
    mockIntroductionFindMany.mockResolvedValue([]);
    mockProfileFindUnique.mockResolvedValue({ completionScore: 80 });

    const queue = await getActionQueue(USER_ID);

    expect(queue.some((i) => i.type === 'COMPLETE_PROFILE')).toBe(false);
  });

  it('returns empty array when no actions needed', async () => {
    mockConnectionFindMany.mockResolvedValue([]);
    mockIntroductionFindMany.mockResolvedValue([]);
    mockProfileFindUnique.mockResolvedValue({ completionScore: 95 });

    const queue = await getActionQueue(USER_ID);

    expect(queue).toEqual([]);
  });
});

// ── getMomentumData ────────────────────────────────────────────────────────────

describe('getMomentumData', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns exactly 7 data points ordered oldest to newest', async () => {
    mockProfileViewCount.mockResolvedValue(3);

    const data = await getMomentumData(USER_ID);

    expect(data).toHaveLength(7);
    expect(data[0].date < data[6].date).toBe(true);
    expect(data.every((d) => d.views === 3)).toBe(true);
  });

  it('each data point has date in YYYY-MM-DD format', async () => {
    mockProfileViewCount.mockResolvedValue(0);

    const data = await getMomentumData(USER_ID);

    expect(data.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date))).toBe(true);
  });

  it('returns zero views when no views exist', async () => {
    mockProfileViewCount.mockResolvedValue(0);

    const data = await getMomentumData(USER_ID);

    expect(data.every((d) => d.views === 0)).toBe(true);
  });
});
