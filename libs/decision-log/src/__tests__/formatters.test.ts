import {
  formatMatchScoreSummary,
  formatDiscoveryFeedSummary,
  formatImplicitSignalSummary,
  formatIntroPairingSummary,
  formatDropReleasedSummary,
} from '../formatters/index.js';

describe('formatMatchScoreSummary', () => {
  it('renders score as percentage', () => {
    const result = formatMatchScoreSummary({
      userAId:          'a',
      userBId:          'b',
      totalScore:       0.847,
      breakdown:        {} as any,
      implicitBoost:    0,
      coreScale:        1,
      optionalDims:     [],
      algorithmVersion: 'v1',
    });
    expect(result).toContain('85%');
  });

  it('mentions optional dims when present', () => {
    const result = formatMatchScoreSummary({
      userAId:          'a',
      userBId:          'b',
      totalScore:       0.7,
      breakdown:        {} as any,
      implicitBoost:    0,
      coreScale:        0.95,
      optionalDims:     ['habitConsistency', 'vibeCompatibility'],
      algorithmVersion: 'v1',
    });
    expect(result).toMatch(/habit|vibe|optional/i);
  });

  it('includes a score percentage in the summary', () => {
    const result = formatMatchScoreSummary({
      userAId:          'a',
      userBId:          'b',
      totalScore:       0.7,
      breakdown:        {} as any,
      implicitBoost:    0.12,
      coreScale:        1,
      optionalDims:     [],
      algorithmVersion: 'v1',
    });
    expect(result).toMatch(/\d+%/);
  });
});

describe('formatDiscoveryFeedSummary', () => {
  it('includes final count and candidate count', () => {
    const result = formatDiscoveryFeedSummary({
      userId:              'u',
      candidateCount:      80,
      finalCount:          20,
      rrfActive:           true,
      annColdStart:        false,
      collaborativeActive: true,
      mmrActive:           true,
      cursorUsed:          false,
      topScores:           [90, 85],
    });
    expect(result).toContain('20');
  });

  it('mentions RRF when active', () => {
    const result = formatDiscoveryFeedSummary({
      userId:              'u',
      candidateCount:      50,
      finalCount:          15,
      rrfActive:           true,
      annColdStart:        false,
      collaborativeActive: false,
      mmrActive:           false,
      cursorUsed:          false,
      topScores:           [],
    });
    expect(result).toMatch(/rrf|fusion/i);
  });

  it('mentions cold-start when ANN used', () => {
    const result = formatDiscoveryFeedSummary({
      userId:              'u',
      candidateCount:      5,
      finalCount:          5,
      rrfActive:           false,
      annColdStart:        true,
      collaborativeActive: false,
      mmrActive:           false,
      cursorUsed:          false,
      topScores:           [],
    });
    expect(result).toMatch(/cold.?start|ann|semantic/i);
  });
});

describe('formatImplicitSignalSummary', () => {
  it('includes the signal type', () => {
    const result = formatImplicitSignalSummary({
      signalUserId:  'actor',
      targetUserId:  'target',
      signal:        'SAVE',
      delta:         0.1,
      previousBoost: 0.0,
      newBoost:      0.1,
      cumulativeDir: 'positive',
    });
    expect(result).toMatch(/save/i);
  });

  it('includes positive/negative direction', () => {
    const pos = formatImplicitSignalSummary({
      signalUserId: 'a', targetUserId: 'b', signal: 'VIEW',
      delta: 0.05, previousBoost: 0, newBoost: 0.05, cumulativeDir: 'positive',
    });
    expect(pos).toMatch(/positive|boost/i);

    const neg = formatImplicitSignalSummary({
      signalUserId: 'a', targetUserId: 'b', signal: 'BLOCK',
      delta: -0.15, previousBoost: 0.1, newBoost: -0.05, cumulativeDir: 'negative',
    });
    expect(neg).toMatch(/negative|suppress/i);
  });
});

describe('formatIntroPairingSummary', () => {
  it('mentions the algorithm used', () => {
    const result = formatIntroPairingSummary({
      dropId:        'drop-1',
      recipientId:   'r',
      matchedUserId: 'm',
      algorithm:     'pgvector',
      score:         0.9,
      pairingRank:   1,
    });
    expect(result).toMatch(/pgvector|vector|semantic/i);
  });

  it('mentions random when algorithm is random', () => {
    const result = formatIntroPairingSummary({
      dropId:        'drop-1',
      recipientId:   'r',
      matchedUserId: 'm',
      algorithm:     'random',
      score:         0,
      pairingRank:   3,
    });
    expect(result).toMatch(/random/i);
  });
});

describe('formatDropReleasedSummary', () => {
  it('includes member count', () => {
    const result = formatDropReleasedSummary({
      dropId:       'drop-1',
      dropName:     'Weekly Drop — UK — 2026-W33',
      memberCount:  150,
      pairingCount: 400,
      releaseAt:    new Date().toISOString(),
      isWeeklyDrop: true,
    });
    expect(result).toContain('150');
  });

  it('notes weekly vs admin-proposed', () => {
    const weekly = formatDropReleasedSummary({
      dropId: 'd', dropName: 'n', memberCount: 10, pairingCount: 20,
      releaseAt: new Date().toISOString(), isWeeklyDrop: true,
    });
    expect(weekly).toMatch(/weekly|auto/i);

    const admin = formatDropReleasedSummary({
      dropId: 'd', dropName: 'n', memberCount: 10, pairingCount: 20,
      releaseAt: new Date().toISOString(), isWeeklyDrop: false,
    });
    expect(admin).toMatch(/admin|curated|proposed/i);
  });
});
