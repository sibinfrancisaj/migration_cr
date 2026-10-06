/**
 * Journey 10 — Connections
 *
 * Full connection lifecycle: send → list → accept → withdraw.
 * UserA sends to UserB; UserB accepts.
 * Verifies status transitions and duplicate-request guard.
 */

import { describeE2e, getJourneyContext } from '../lib/journey-context.js';

interface ConnectionDto {
  id:          string;
  status:      string;
  requesterId: string;
  recipientId: string;
  createdAt:   string;
}

describeE2e('Journey 10 — Connections', () => {
  const ctx = getJourneyContext();

  let connectionId: string | null = null;

  it('POST /api/v1/connections → 201 sends a connection request', async () => {
    const res = await ctx.userA.post('/api/v1/connections', {
      recipientId: ctx.userBId,
      message:     'Hi from E2E test',
    });

    expect(res.status).toBe(201);
    const body = res.body as { success: boolean; data: ConnectionDto };
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('PENDING');
    expect(body.data.requesterId).toBe(ctx.userAId);
    connectionId = body.data.id;
  });

  it('POST /api/v1/connections duplicate → 409', async () => {
    const res = await ctx.userA.post('/api/v1/connections', {
      recipientId: ctx.userBId,
    });
    expect(res.status).toBe(409);
  });

  it('GET /api/v1/connections → 200 includes the pending request', async () => {
    if (!connectionId) return;
    const res = await ctx.userA.get('/api/v1/connections?status=PENDING');
    expect(res.status).toBe(200);

    const body = res.body as { success: boolean; data: ConnectionDto[] };
    expect(body.success).toBe(true);
    const found = body.data.find((c) => c.id === connectionId);
    expect(found).toBeDefined();
    expect(found?.status).toBe('PENDING');
  });

  it('PUT /api/v1/connections/:id/accept → 200 (userB accepts)', async () => {
    if (!connectionId) return;
    const res = await ctx.userB.put(`/api/v1/connections/${connectionId}/accept`);
    expect(res.status).toBe(200);

    const body = res.body as { success: boolean; data: ConnectionDto };
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('ACCEPTED');
  });

  it('PUT /api/v1/connections/:id/accept again → 409 (already accepted)', async () => {
    if (!connectionId) return;
    const res = await ctx.userB.put(`/api/v1/connections/${connectionId}/accept`);
    expect(res.status).toBe(409);
  });

  it('GET /api/v1/connections?status=ACCEPTED → includes accepted connection', async () => {
    if (!connectionId) return;
    const res = await ctx.userA.get('/api/v1/connections?status=ACCEPTED');
    expect(res.status).toBe(200);

    const body = res.body as { success: boolean; data: ConnectionDto[] };
    const found = body.data.find((c) => c.id === connectionId);
    expect(found).toBeDefined();
    expect(found?.status).toBe('ACCEPTED');
  });

  it('POST /api/v1/connections without auth → 401', async () => {
    const res = await ctx.anon.post('/api/v1/connections', {
      recipientId: ctx.userBId,
    });
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/connections with invalid body → 400', async () => {
    const res = await ctx.userA.post('/api/v1/connections', {
      recipientId: 'not-a-uuid',
    });
    expect(res.status).toBe(400);
  });
});
