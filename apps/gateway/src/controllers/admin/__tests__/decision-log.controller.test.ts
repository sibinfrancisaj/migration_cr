import request from 'supertest';
import express, { type Request, type Response, type NextFunction } from 'express';
import { decisionLogController } from '../decision-log.controller.js';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockQueryDecisionLogs = jest.fn();
const mockGetMatchStory      = jest.fn();
const mockGetUserTimeline    = jest.fn();

jest.mock('@abroad-matrimony/decision-log', () => ({
  queryDecisionLogs: (...args: unknown[]) => mockQueryDecisionLogs(...args),
  getMatchStory:     (...args: unknown[]) => mockGetMatchStory(...args),
  getUserTimeline:   (...args: unknown[]) => mockGetUserTimeline(...args),
}));

jest.mock('@abroad-matrimony/auth', () => ({
  requireAdminRole: () => (_req: any, _res: any, next: any) => next(),
}));

// ── Test app ──────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json());
app.get('/admin/decision-logs',              decisionLogController.list);
app.get('/admin/decision-logs/match-story',  decisionLogController.matchStory);
app.get('/admin/decision-logs/user-timeline', decisionLogController.userTimeline);

// Minimal error handler: converts AppError to its status, unknown errors to 500
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.statusCode ?? err.status ?? 500;
  res.status(status).json({ success: false, message: err.message });
});

// ── Sample data ───────────────────────────────────────────────────────────────

const sampleEntry = {
  id:           'log-id-1',
  actorUserId:  'user-a',
  targetUserId: 'user-b',
  eventType:    'MATCH_SCORE_COMPUTED',
  summary:      'Match score computed at 82%.',
  narrative:    null,
  data:         { totalScore: 0.82 },
  sessionId:    null,
  confidence:   'HIGH',
  createdAt:    new Date().toISOString(),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /admin/decision-logs', () => {
  beforeEach(() => jest.clearAllMocks());

  it('200 — returns paginated decision logs', async () => {
    mockQueryDecisionLogs.mockResolvedValue({ items: [sampleEntry], total: 1 });

    const res = await request(app).get('/admin/decision-logs');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].eventType).toBe('MATCH_SCORE_COMPUTED');
    expect(res.body.meta).toMatchObject({ total: 1 });
  });

  it('200 — accepts filter query params', async () => {
    mockQueryDecisionLogs.mockResolvedValue({ items: [], total: 0 });
    const userId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

    await request(app)
      .get('/admin/decision-logs')
      .query({ actorUserId: userId, eventType: 'IMPLICIT_SIGNAL_APPLIED', limit: 10, page: 2 });

    expect(mockQueryDecisionLogs).toHaveBeenCalledWith(
      expect.objectContaining({ actorUserId: userId, eventType: 'IMPLICIT_SIGNAL_APPLIED', limit: 10, page: 2 }),
    );
  });

  it('400 — invalid UUID for actorUserId', async () => {
    const res = await request(app)
      .get('/admin/decision-logs')
      .query({ actorUserId: 'not-a-uuid' });

    expect(res.status).toBe(400);
  });

  it('500 — service error propagates', async () => {
    mockQueryDecisionLogs.mockRejectedValue(new Error('DB error'));

    const res = await request(app).get('/admin/decision-logs');
    expect(res.status).toBe(500);
  });
});

describe('GET /admin/decision-logs/match-story', () => {
  const userA = 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa';
  const userB = 'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb';

  beforeEach(() => jest.clearAllMocks());

  it('200 — returns match story', async () => {
    mockGetMatchStory.mockResolvedValue({
      userAId:      userA,
      userBId:      userB,
      entries:      [{ ...sampleEntry, timestamp: new Date() }],
      currentScore: 82,
    });

    const res = await request(app)
      .get('/admin/decision-logs/match-story')
      .query({ userA, userB });

    expect(res.status).toBe(200);
    expect(res.body.data.userAId).toBe(userA);
    expect(res.body.data.entries).toHaveLength(1);
  });

  it('400 — missing userA', async () => {
    const res = await request(app)
      .get('/admin/decision-logs/match-story')
      .query({ userB });

    expect(res.status).toBe(400);
  });

  it('400 — invalid UUID for userB', async () => {
    const res = await request(app)
      .get('/admin/decision-logs/match-story')
      .query({ userA, userB: 'not-uuid' });

    expect(res.status).toBe(400);
  });
});

describe('GET /admin/decision-logs/user-timeline', () => {
  const userId = 'cccccccc-3333-3333-3333-cccccccccccc';

  beforeEach(() => jest.clearAllMocks());

  it('200 — returns timeline entries', async () => {
    mockGetUserTimeline.mockResolvedValue([sampleEntry, sampleEntry]);

    const res = await request(app)
      .get('/admin/decision-logs/user-timeline')
      .query({ userId });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta.total).toBe(2);
  });

  it('400 — missing userId', async () => {
    const res = await request(app).get('/admin/decision-logs/user-timeline');
    expect(res.status).toBe(400);
  });

  it('400 — limit over maximum', async () => {
    const res = await request(app)
      .get('/admin/decision-logs/user-timeline')
      .query({ userId, limit: 9999 });

    expect(res.status).toBe(400);
  });

  it('500 — service error propagates', async () => {
    mockGetUserTimeline.mockRejectedValue(new Error('Timeout'));

    const res = await request(app)
      .get('/admin/decision-logs/user-timeline')
      .query({ userId });

    expect(res.status).toBe(500);
  });
});
