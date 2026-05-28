import {
  processScoreRecompute,
  createScoreRecomputeWorker,
  enqueueScoreRecompute,
} from '../score-recompute.worker.js';
import { Worker as BullWorker, Queue as BullQueue } from 'bullmq';
import { CLOUD_EVENT_TYPES, QUEUE_NAMES } from '@abroad-matrimony/shared';
import { UserProfileMissingError } from '../match-score.service.js';

// ── DB mock ───────────────────────────────────────────────────────────────────

const mockProfileFindMany    = jest.fn();
const mockMatchScoreFindMany = jest.fn();

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    profile: {
      findMany: (...args: unknown[]) => mockProfileFindMany(...args),
    },
    matchScore: {
      findMany: (...args: unknown[]) => mockMatchScoreFindMany(...args),
    },
  },
  PrismaClient: jest.fn(),
  Prisma: {},
}));

// ── Logger mock ───────────────────────────────────────────────────────────────

jest.mock('@abroad-matrimony/logger', () => ({
  createChildLogger: () => ({
    info:  jest.fn(),
    warn:  jest.fn(),
    error: jest.fn(),
  }),
}));

// ── Event-bus mock ────────────────────────────────────────────────────────────

const mockPublish = jest.fn();
jest.mock('@abroad-matrimony/event-bus', () => ({
  publish: (...args: unknown[]) => mockPublish(...args),
}));

// ── match-score.service mock (keep real error class for instanceof checks) ────

const mockComputeAndSaveScore = jest.fn();
jest.mock('../match-score.service.js', () => {
  const actual = jest.requireActual('../match-score.service.js') as typeof import('../match-score.service.js');
  return {
    ...actual,
    computeAndSaveScore: (...args: unknown[]) => mockComputeAndSaveScore(...args),
  };
});

// ── BullMQ mock ───────────────────────────────────────────────────────────────
// All mock state lives inside the factory so there are no external-variable
// hoisting issues.  Tests access the mocked constructors via jest.mocked().

jest.mock('bullmq', () => ({
  Worker: jest.fn().mockImplementation(() => ({
    on:    jest.fn(),
    close: jest.fn(),
  })),
  Queue: jest.fn().mockImplementation(() => ({
    add:   jest.fn().mockResolvedValue({ id: 'job-1' }),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

// Typed references to the mocked BullMQ constructors
const MockedWorker = jest.mocked(BullWorker);
const MockedQueue  = jest.mocked(BullQueue);

// ── Helpers ───────────────────────────────────────────────────────────────────

function setHappyPathMocks(): void {
  mockProfileFindMany.mockResolvedValue([
    { userId: 'user-a' },
    { userId: 'user-b' },
  ]);
  mockMatchScoreFindMany.mockResolvedValue([]);           // no fresh pairs
  mockComputeAndSaveScore.mockResolvedValue(undefined);
  mockPublish.mockResolvedValue(undefined);
}

// ── processScoreRecompute() ───────────────────────────────────────────────────

describe('processScoreRecompute()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setHappyPathMocks();
  });

  // ── Result shape ────────────────────────────────────────────────────────────

  it('returns a ScoreRecomputeResult with the correct shape', async () => {
    const result = await processScoreRecompute({});

    expect(result).toMatchObject({
      totalUsers: 2,
      totalPairs: 1,
      computed:   1,
      skipped:    0,
      errors:     0,
    });
  });

  // ── Zero / one user ─────────────────────────────────────────────────────────

  it('returns 0 pairs and skips the stale-check query when there are no users', async () => {
    mockProfileFindMany.mockResolvedValue([]);

    const result = await processScoreRecompute({});

    expect(result.totalUsers).toBe(0);
    expect(result.totalPairs).toBe(0);            // must be +0, not -0
    expect(result.computed).toBe(0);
    expect(mockMatchScoreFindMany).not.toHaveBeenCalled();
    expect(mockComputeAndSaveScore).not.toHaveBeenCalled();
  });

  it('returns 0 pairs when there is only one user', async () => {
    mockProfileFindMany.mockResolvedValue([{ userId: 'user-a' }]);

    const result = await processScoreRecompute({});

    expect(result.totalPairs).toBe(0);
    expect(mockComputeAndSaveScore).not.toHaveBeenCalled();
  });

  // ── Pair enumeration ────────────────────────────────────────────────────────

  it('computes 1 pair for 2 users', async () => {
    await processScoreRecompute({});

    expect(mockComputeAndSaveScore).toHaveBeenCalledTimes(1);
  });

  it('computes 3 pairs for 3 users', async () => {
    mockProfileFindMany.mockResolvedValue([
      { userId: 'user-a' },
      { userId: 'user-b' },
      { userId: 'user-c' },
    ]);

    const result = await processScoreRecompute({});

    expect(result.totalPairs).toBe(3);
    expect(result.computed).toBe(3);
    expect(mockComputeAndSaveScore).toHaveBeenCalledTimes(3);
  });

  // ── Stale-check (force: false) ──────────────────────────────────────────────

  it('skips a pair that is already in the recent-score set', async () => {
    // Canonical order: 'user-a' < 'user-b' lexicographically
    mockMatchScoreFindMany.mockResolvedValue([
      { userAId: 'user-a', userBId: 'user-b' },
    ]);

    const result = await processScoreRecompute({ force: false });

    expect(result.skipped).toBe(1);
    expect(result.computed).toBe(0);
    expect(mockComputeAndSaveScore).not.toHaveBeenCalled();
  });

  it('queries the stale set with a threshold ~24 h in the past', async () => {
    const before = Date.now();
    await processScoreRecompute({ force: false });
    const after = Date.now();

    expect(mockMatchScoreFindMany).toHaveBeenCalledTimes(1);
    const threshold: Date = mockMatchScoreFindMany.mock.calls[0][0].where.computedAt.gte;

    expect(threshold.getTime()).toBeGreaterThanOrEqual(before - 24 * 3_600_000 - 50);
    expect(threshold.getTime()).toBeLessThanOrEqual(after  - 24 * 3_600_000 + 50);
  });

  // ── force: true ─────────────────────────────────────────────────────────────

  it('does not query the stale set when force is true', async () => {
    await processScoreRecompute({ force: true });

    expect(mockMatchScoreFindMany).not.toHaveBeenCalled();
  });

  it('recomputes even fresh pairs when force is true', async () => {
    mockMatchScoreFindMany.mockResolvedValue([
      { userAId: 'user-a', userBId: 'user-b' },
    ]);

    const result = await processScoreRecompute({ force: true });

    expect(result.computed).toBe(1);
    expect(result.skipped).toBe(0);
  });

  // ── Error handling ──────────────────────────────────────────────────────────

  it('increments errors when computeAndSaveScore throws UserProfileMissingError', async () => {
    mockComputeAndSaveScore.mockRejectedValueOnce(
      new UserProfileMissingError('user-a'),
    );

    const result = await processScoreRecompute({});

    expect(result.errors).toBe(1);
    expect(result.computed).toBe(0);
  });

  it('increments errors when computeAndSaveScore throws a generic error', async () => {
    mockComputeAndSaveScore.mockRejectedValueOnce(new Error('DB timeout'));

    const result = await processScoreRecompute({});

    expect(result.errors).toBe(1);
    expect(result.computed).toBe(0);
  });

  it('continues processing remaining pairs after an individual error', async () => {
    mockProfileFindMany.mockResolvedValue([
      { userId: 'user-a' },
      { userId: 'user-b' },
      { userId: 'user-c' },
    ]);
    mockComputeAndSaveScore
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue(undefined);

    const result = await processScoreRecompute({});

    expect(result.errors).toBe(1);
    expect(result.computed).toBe(2);
    expect(result.totalPairs).toBe(3);
  });

  // ── CloudEvent ───────────────────────────────────────────────────────────────

  it('publishes SCORE_RECOMPUTE_COMPLETED with the result payload', async () => {
    const result = await processScoreRecompute({});

    expect(mockPublish).toHaveBeenCalledTimes(1);
    expect(mockPublish).toHaveBeenCalledWith(
      CLOUD_EVENT_TYPES.SCORE_RECOMPUTE_COMPLETED,
      expect.objectContaining({
        totalUsers: result.totalUsers,
        totalPairs: result.totalPairs,
        computed:   result.computed,
        skipped:    result.skipped,
        errors:     result.errors,
      }),
    );
  });

  it('publishes SCORE_RECOMPUTE_COMPLETED even when all pairs errored', async () => {
    mockComputeAndSaveScore.mockRejectedValue(new Error('always fails'));

    await processScoreRecompute({});

    expect(mockPublish).toHaveBeenCalledWith(
      CLOUD_EVENT_TYPES.SCORE_RECOMPUTE_COMPLETED,
      expect.objectContaining({ errors: 1 }),
    );
  });

  // ── Progress reporting ───────────────────────────────────────────────────────

  it('calls onProgress with 100 after the single pair for 2 users', async () => {
    const onProgress = jest.fn().mockResolvedValue(undefined);

    await processScoreRecompute({}, onProgress);

    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledWith(100);
  });

  it('calls onProgress once per pair for 3 users', async () => {
    mockProfileFindMany.mockResolvedValue([
      { userId: 'user-a' },
      { userId: 'user-b' },
      { userId: 'user-c' },
    ]);
    const onProgress = jest.fn().mockResolvedValue(undefined);

    await processScoreRecompute({}, onProgress);

    // 3 pairs → 3 progress callbacks
    expect(onProgress).toHaveBeenCalledTimes(3);
  });
});

// ── createScoreRecomputeWorker() ──────────────────────────────────────────────

describe('createScoreRecomputeWorker()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a BullMQ Worker on the MATCHING queue with concurrency 1', () => {
    createScoreRecomputeWorker('redis://localhost:6379');

    expect(MockedWorker).toHaveBeenCalledWith(
      QUEUE_NAMES.MATCHING,
      expect.any(Function),
      expect.objectContaining({ concurrency: 1 }),
    );
  });

  it('registers "completed" and "failed" event listeners on the worker', () => {
    createScoreRecomputeWorker('redis://localhost:6379');

    // Get the worker instance that was created
    const workerInst = MockedWorker.mock.results[0].value as { on: jest.Mock };
    const registeredEvents = workerInst.on.mock.calls.map(
      (c: unknown[]) => c[0] as string,
    );

    expect(registeredEvents).toContain('completed');
    expect(registeredEvents).toContain('failed');
  });
});

// ── enqueueScoreRecompute() ───────────────────────────────────────────────────

describe('enqueueScoreRecompute()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a Queue on the MATCHING queue name', async () => {
    await enqueueScoreRecompute('redis://localhost:6379');

    expect(MockedQueue).toHaveBeenCalledWith(
      QUEUE_NAMES.MATCHING,
      expect.any(Object),
    );
  });

  it('calls queue.add with the job name and provided data', async () => {
    await enqueueScoreRecompute('redis://localhost:6379', { force: true });

    const queueInst = MockedQueue.mock.results[0].value as {
      add: jest.Mock;
      close: jest.Mock;
    };
    expect(queueInst.add).toHaveBeenCalledWith(
      'score-recompute',
      { force: true },
      expect.objectContaining({ jobId: 'score-recompute' }),
    );
  });

  it('uses the fixed jobId "score-recompute" for BullMQ deduplication', async () => {
    await enqueueScoreRecompute('redis://localhost:6379');

    const queueInst = MockedQueue.mock.results[0].value as { add: jest.Mock };
    const opts = queueInst.add.mock.calls[0][2] as { jobId: string };
    expect(opts.jobId).toBe('score-recompute');
  });

  it('always calls queue.close even when queue.add throws', async () => {
    // Override the Queue implementation for this one test
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    MockedQueue.mockImplementationOnce((() => ({
      add:   jest.fn().mockRejectedValue(new Error('Redis down')),
      close: jest.fn().mockResolvedValue(undefined),
    })) as any);

    await expect(
      enqueueScoreRecompute('redis://localhost:6379'),
    ).rejects.toThrow('Redis down');

    const queueInst = MockedQueue.mock.results[0].value as { close: jest.Mock };
    expect(queueInst.close).toHaveBeenCalledTimes(1);
  });
});
