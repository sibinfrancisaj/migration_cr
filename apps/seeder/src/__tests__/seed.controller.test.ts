/**
 * SEED-008 tests — Seeder control API.
 * Tests the Express app routes via supertest, mocking all service dependencies.
 */
import request from 'supertest';
import { createSeederApp } from '../app.js';

// ── Env mock ───────────────────────────────────────────────────────────────────
jest.mock('../lib/seeder-env.js', () => ({
  getSeederEnv: () => ({
    SEEDER_SECRET: 'test-seeder-secret-min-32-chars!!',
    SEEDER_PORT: 3100,
    GATEWAY_URL: 'http://localhost:3000',
    SEEDER_PHOTO_S3_PREFIX: 'seeder/profile-photos',
    SEEDER_INITIAL_COUNT: 500,
    SEEDER_DRIP_MIN: 3,
    SEEDER_DRIP_MAX: 5,
    SEEDER_DRIP_INTERVAL_HOURS: 3,
    REDIS_URL: 'redis://localhost:6379',
  }),
}));

// ── State mock ─────────────────────────────────────────────────────────────────
const mockState = { running: false, dripPaused: false, lastRunAt: null, lastDripAt: null, lastMatchRecomputeAt: null };

jest.mock('../lib/seeder-state.js', () => ({
  getState: () => mockState,
  pauseDrip: jest.fn(() => { mockState.dripPaused = true; }),
  resumeDrip: jest.fn(() => { mockState.dripPaused = false; }),
  setRunning: jest.fn(),
  setDripCompleted: jest.fn(),
  setMatchRecomputeAt: jest.fn(),
}));

// ── Service mocks ──────────────────────────────────────────────────────────────
const mockGetStatus = jest.fn();
const mockFlush = jest.fn();
const mockTriggerDrip = jest.fn();

jest.mock('../services/status.service.js', () => ({
  getSeederStatus: (...a: unknown[]) => mockGetStatus(...a),
}));

jest.mock('../services/flush.service.js', () => ({
  flushAllSeededData: (...a: unknown[]) => mockFlush(...a),
}));

jest.mock('../jobs/drip.job.js', () => ({
  triggerImmediateDrip: (...a: unknown[]) => mockTriggerDrip(...a),
  scheduleDripJob: jest.fn().mockResolvedValue(undefined),
  startDripWorker: jest.fn(),
  closeDripWorker: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../lib/seeder-logger.js', () => ({
  seederLog: { info: jest.fn(), warn: jest.fn(), debug: jest.fn(), error: jest.fn() },
}));

const SEEDER_KEY = 'test-seeder-secret-min-32-chars!!';
const app = createSeederApp();

beforeEach(() => jest.clearAllMocks());

// ── GET /health ────────────────────────────────────────────────────────────────
describe('GET /health', () => {
  it('returns 200 without auth', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

// ── GET /seed/status ───────────────────────────────────────────────────────────
describe('GET /seed/status', () => {
  it('returns 401 without seeder key', async () => {
    const res = await request(app).get('/seed/status');
    expect(res.status).toBe(401);
  });

  it('returns 200 with valid key', async () => {
    mockGetStatus.mockResolvedValue({ running: false, totalSeededUsers: 42, dripPaused: false });

    const res = await request(app)
      .get('/seed/status')
      .set('X-Seeder-Key', SEEDER_KEY);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalSeededUsers).toBe(42);
  });

  it('returns 500 when status service throws', async () => {
    mockGetStatus.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .get('/seed/status')
      .set('X-Seeder-Key', SEEDER_KEY);

    expect(res.status).toBe(500);
  });
});

// ── POST /seed/run ─────────────────────────────────────────────────────────────
describe('POST /seed/run', () => {
  it('returns 401 without seeder key', async () => {
    const res = await request(app).post('/seed/run');
    expect(res.status).toBe(401);
  });

  it('returns 202 and triggers drip when not running', async () => {
    mockTriggerDrip.mockResolvedValue('job-123');

    const res = await request(app)
      .post('/seed/run')
      .set('X-Seeder-Key', SEEDER_KEY);

    expect(res.status).toBe(202);
    expect(res.body.data.jobId).toBe('job-123');
  });

  it('returns 409 when seeder is already running', async () => {
    mockState.running = true;

    const res = await request(app)
      .post('/seed/run')
      .set('X-Seeder-Key', SEEDER_KEY);

    expect(res.status).toBe(409);
    mockState.running = false;
  });
});

// ── POST /seed/flush ───────────────────────────────────────────────────────────
describe('POST /seed/flush', () => {
  it('returns 401 without seeder key', async () => {
    const res = await request(app).post('/seed/flush').send({ confirm: 'FLUSH_ALL_SEEDED_DATA' });
    expect(res.status).toBe(401);
  });

  it('returns 400 when confirm string is missing', async () => {
    const res = await request(app)
      .post('/seed/flush')
      .set('X-Seeder-Key', SEEDER_KEY)
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 400 when confirm string is wrong', async () => {
    const res = await request(app)
      .post('/seed/flush')
      .set('X-Seeder-Key', SEEDER_KEY)
      .send({ confirm: 'yes' });

    expect(res.status).toBe(400);
  });

  it('returns 200 with deletion counts on success', async () => {
    mockFlush.mockResolvedValue({ deleted: { users: 100, profiles: 100 }, durationMs: 250 });

    const res = await request(app)
      .post('/seed/flush')
      .set('X-Seeder-Key', SEEDER_KEY)
      .send({ confirm: 'FLUSH_ALL_SEEDED_DATA' });

    expect(res.status).toBe(200);
    expect(res.body.data.deleted.users).toBe(100);
  });

  it('returns 409 when flush is blocked by running job', async () => {
    mockFlush.mockRejectedValue(new Error('Cannot flush while a seeder job is running'));

    const res = await request(app)
      .post('/seed/flush')
      .set('X-Seeder-Key', SEEDER_KEY)
      .send({ confirm: 'FLUSH_ALL_SEEDED_DATA' });

    expect(res.status).toBe(409);
  });
});

// ── POST /seed/pause ───────────────────────────────────────────────────────────
describe('POST /seed/pause + /seed/resume', () => {
  it('returns 401 without key', async () => {
    const res = await request(app).post('/seed/pause');
    expect(res.status).toBe(401);
  });

  it('pauses the drip', async () => {
    mockState.dripPaused = false;

    const res = await request(app)
      .post('/seed/pause')
      .set('X-Seeder-Key', SEEDER_KEY);

    expect(res.status).toBe(200);
    expect(res.body.data.dripPaused).toBe(true);
  });

  it('resumes the drip', async () => {
    mockState.dripPaused = true;

    const res = await request(app)
      .post('/seed/resume')
      .set('X-Seeder-Key', SEEDER_KEY);

    expect(res.status).toBe(200);
    expect(res.body.data.dripPaused).toBe(false);
  });
});

// ── 404 ───────────────────────────────────────────────────────────────────────
describe('Unknown routes', () => {
  it('returns 404', async () => {
    const res = await request(app).get('/unknown');
    expect(res.status).toBe(404);
  });
});
