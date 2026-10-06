/**
 * Journey 17 — Weekly Prompts
 *
 * Get current prompt, submit response, list community responses, resonate.
 */

import { describeE2e, getJourneyContext } from '../lib/journey-context.js';

describeE2e('Journey 17 — Weekly prompts', () => {
  const ctx = getJourneyContext();

  let currentPromptId: string | null = null;
  let responseId: string | null = null;

  it('GET /api/v1/prompts/current → 200 or 404 (depends on admin setup)', async () => {
    const res = await ctx.userA.get('/api/v1/prompts/current');
    expect([200, 404]).toContain(res.status);

    if (res.status === 200) {
      const body = res.body as { success: boolean; data: { id: string; text: string } };
      expect(body.success).toBe(true);
      expect(typeof body.data.id).toBe('string');
      expect(typeof body.data.text).toBe('string');
      currentPromptId = body.data.id;
    }
  });

  it('POST /api/v1/prompts/current/response → 201 if prompt exists', async () => {
    if (!currentPromptId) {
      console.warn('[e2e] No current prompt — skipping response submission');
      return;
    }

    const res = await ctx.userA.post('/api/v1/prompts/current/response', {
      text: 'E2E test response to this week\'s prompt.',
    });
    expect([200, 201, 409]).toContain(res.status); // 409 if already responded
    if (res.status === 201 || res.status === 200) {
      const body = res.body as { success: boolean; data: { id: string } };
      expect(body.success).toBe(true);
      responseId = body.data.id;
    }
  });

  it('GET /api/v1/prompts/current/responses → 200 with paginated list', async () => {
    if (!currentPromptId) return;

    const res = await ctx.userA.get('/api/v1/prompts/current/responses?limit=10');
    expect(res.status).toBe(200);

    const body = res.body as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('POST /api/v1/prompts/responses/:id/resonate → 200 if response exists', async () => {
    if (!responseId) {
      console.warn('[e2e] No response id — skipping resonate test');
      return;
    }
    const res = await ctx.userB.post(`/api/v1/prompts/responses/${responseId}/resonate`);
    expect([200, 201]).toContain(res.status);
  });

  it('GET /api/v1/prompts/current without auth → 401', async () => {
    const res = await ctx.anon.get('/api/v1/prompts/current');
    expect(res.status).toBe(401);
  });
});
