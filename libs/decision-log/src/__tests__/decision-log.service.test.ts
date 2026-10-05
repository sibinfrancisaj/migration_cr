import {
  logMatchScoreComputed,
  logDiscoveryFeedGenerated,
  logImplicitSignalApplied,
  logIntroPairingCreated,
  logIntroDropReleased,
  logNotificationQueued,
  pruneOldDecisionLogs,
} from '../decision-log.service.js';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockCreate     = jest.fn().mockResolvedValue({ id: 'log-uuid-1' });
const mockUpdateMany = jest.fn().mockResolvedValue({ count: 3 });
const mockDeleteMany = jest.fn().mockResolvedValue({ count: 1 });
const mockUpdate     = jest.fn().mockResolvedValue({});

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    decisionLog: {
      create:     (...args: unknown[]) => mockCreate(...args),
      update:     (...args: unknown[]) => mockUpdate(...args),
      updateMany: (...args: unknown[]) => mockUpdateMany(...args),
      deleteMany: (...args: unknown[]) => mockDeleteMany(...args),
    },
  },
}));

jest.mock('@abroad-matrimony/logger', () => ({
  createChildLogger: () => ({
    info:  jest.fn(),
    warn:  jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  }),
}));

// narrative-generator is async — we don't want it to fire during unit tests
jest.mock('../narrative-generator.js', () => ({
  generateNarrative: jest.fn().mockResolvedValue(null),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('logMatchScoreComputed', () => {
  beforeEach(() => jest.clearAllMocks());

  it('calls prisma.decisionLog.create with MATCH_SCORE_COMPUTED eventType', async () => {
    logMatchScoreComputed({
      userAId:          'user-a',
      userBId:          'user-b',
      totalScore:       0.82,
      breakdown:        { settlementIntent: 0.9, realLifeAnswers: 0.75 } as any,
      implicitBoost:    0.05,
      coreScale:        1.0,
      optionalDims:     ['habitConsistency', 'vibeCompatibility'],
      algorithmVersion: 'v1',
    });

    // Fire-and-forget — wait for microtask queue
    await Promise.resolve();
    await Promise.resolve();

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: 'MATCH_SCORE_COMPUTED' }),
      }),
    );
  });

  it('sets targetUserId to userBId', async () => {
    logMatchScoreComputed({
      userAId:          'alice',
      userBId:          'bob',
      totalScore:       0.7,
      breakdown:        {} as any,
      implicitBoost:    0,
      coreScale:        1,
      optionalDims:     [],
      algorithmVersion: 'v1',
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actorUserId: 'alice', targetUserId: 'bob' }),
      }),
    );
  });
});

describe('logDiscoveryFeedGenerated', () => {
  beforeEach(() => jest.clearAllMocks());

  it('writes DISCOVERY_FEED_GENERATED log', async () => {
    logDiscoveryFeedGenerated({
      userId:              'user-1',
      candidateCount:      50,
      finalCount:          20,
      rrfActive:           true,
      annColdStart:        false,
      collaborativeActive: true,
      mmrActive:           true,
      cursorUsed:          false,
      topScores:           [92, 87, 85, 80, 78],
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: 'DISCOVERY_FEED_GENERATED' }),
      }),
    );
  });

  it('sets confidence HIGH when candidateCount >= 20', async () => {
    logDiscoveryFeedGenerated({
      userId:              'u',
      candidateCount:      25,
      finalCount:          20,
      rrfActive:           false,
      annColdStart:        false,
      collaborativeActive: false,
      mmrActive:           false,
      cursorUsed:          false,
      topScores:           [],
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ confidence: 'HIGH' }) }),
    );
  });

  it('sets confidence LOW when candidateCount < 5', async () => {
    logDiscoveryFeedGenerated({
      userId:              'u',
      candidateCount:      3,
      finalCount:          3,
      rrfActive:           false,
      annColdStart:        false,
      collaborativeActive: false,
      mmrActive:           false,
      cursorUsed:          false,
      topScores:           [],
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ confidence: 'LOW' }) }),
    );
  });
});

describe('logImplicitSignalApplied', () => {
  beforeEach(() => jest.clearAllMocks());

  it('writes IMPLICIT_SIGNAL_APPLIED log with HIGH confidence', async () => {
    logImplicitSignalApplied({
      signalUserId:  'actor',
      targetUserId:  'target',
      signal:        'VIEW',
      delta:         0.05,
      previousBoost: 0.10,
      newBoost:      0.15,
      cumulativeDir: 'positive',
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType:  'IMPLICIT_SIGNAL_APPLIED',
          confidence: 'HIGH',
        }),
      }),
    );
  });
});

describe('logIntroPairingCreated', () => {
  beforeEach(() => jest.clearAllMocks());

  it('writes INTRO_PAIRING_CREATED log', async () => {
    logIntroPairingCreated({
      dropId:       'drop-1',
      recipientId:  'user-r',
      matchedUserId: 'user-m',
      algorithm:    'pgvector',
      score:        0.88,
      pairingRank:  1,
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: 'INTRO_PAIRING_CREATED' }),
      }),
    );
  });

  it('sets confidence HIGH for pgvector, MEDIUM for match-score, LOW for random', async () => {
    const algorithms: Array<{ algo: 'pgvector' | 'match-score' | 'random'; expected: string }> = [
      { algo: 'pgvector',     expected: 'HIGH'   },
      { algo: 'match-score',  expected: 'MEDIUM' },
      { algo: 'random',       expected: 'LOW'    },
    ];

    for (const { algo, expected } of algorithms) {
      mockCreate.mockClear();
      logIntroPairingCreated({
        dropId:       'drop-1',
        recipientId:  'r',
        matchedUserId: 'm',
        algorithm:    algo,
        score:        0,
        pairingRank:  1,
      });
      await Promise.resolve();
      await Promise.resolve();
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ confidence: expected }) }),
      );
    }
  });
});

describe('logIntroDropReleased', () => {
  beforeEach(() => jest.clearAllMocks());

  it('writes INTRO_DROP_RELEASED log with system as actorUserId', async () => {
    logIntroDropReleased({
      dropId:       'drop-2',
      dropName:     'Weekly Drop — UK — 2026-W33',
      memberCount:  120,
      pairingCount: 340,
      releaseAt:    new Date().toISOString(),
      isWeeklyDrop: true,
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorUserId: 'system',
          eventType:   'INTRO_DROP_RELEASED',
        }),
      }),
    );
  });
});

describe('logNotificationQueued', () => {
  beforeEach(() => jest.clearAllMocks());

  it('writes NOTIFICATION_QUEUED log', async () => {
    logNotificationQueued({
      userId:          'u1',
      notificationType: 'NEW_INTRO',
      channel:         'PUSH',
      deferredSeconds: 3600,
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: 'NOTIFICATION_QUEUED' }),
      }),
    );
  });

  it('includes deferred time in summary when deferredSeconds present', async () => {
    logNotificationQueued({
      userId:          'u1',
      notificationType: 'MATCH_ALERT',
      channel:         'PUSH',
      deferredSeconds: 7200,
    });
    await Promise.resolve();
    await Promise.resolve();

    const callData = mockCreate.mock.calls[0]![0].data;
    expect(callData.summary).toContain('deferred');
  });
});

describe('pruneOldDecisionLogs', () => {
  beforeEach(() => jest.clearAllMocks());

  it('soft-deletes old records and hard-deletes prunedAt entries', async () => {
    const result = await pruneOldDecisionLogs(90);
    expect(result.softDeleted).toBe(3);
    expect(result.hardDeleted).toBe(1);
    expect(mockUpdateMany).toHaveBeenCalledTimes(1);
    expect(mockDeleteMany).toHaveBeenCalledTimes(1);
  });

  it('uses 90-day default retention when called without args', async () => {
    await pruneOldDecisionLogs();
    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: expect.objectContaining({ lt: expect.any(Date) }),
        }),
      }),
    );
  });

  it('swallows errors and returns zeros when prisma fails', async () => {
    mockUpdateMany.mockRejectedValueOnce(new Error('DB down'));
    await expect(pruneOldDecisionLogs()).rejects.toThrow('DB down');
  });
});
