import request from 'supertest';
import { createHealthServer, HEALTH_PATH } from '../health';

describe('createHealthServer', () => {
  it('returns 200 when workers are running', async () => {
    const res = await request(createHealthServer(() => 'ok')).get(HEALTH_PATH);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', service: 'worker' });
  });

  it('returns 503 while starting', async () => {
    const res = await request(createHealthServer(() => 'starting')).get(HEALTH_PATH);
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('starting');
  });

  it('returns 503 while stopping', async () => {
    const res = await request(createHealthServer(() => 'stopping')).get(HEALTH_PATH);
    expect(res.status).toBe(503);
  });

  it('returns 404 for any other path', async () => {
    const res = await request(createHealthServer(() => 'ok')).get('/seed/run');
    expect(res.status).toBe(404);
  });

  it('returns 404 for non-GET methods', async () => {
    const res = await request(createHealthServer(() => 'ok')).post(HEALTH_PATH);
    expect(res.status).toBe(404);
  });
});
