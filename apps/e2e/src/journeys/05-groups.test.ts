/**
 * Journey 05 — Groups
 *
 * List groups, get suggested groups, view a group's members.
 */

import { describeE2e, getJourneyContext } from '../lib/journey-context.js';

interface GroupItem {
  id:          string;
  name:        string;
  type:        string;
  memberCount: number;
}

describeE2e('Journey 05 — Groups', () => {
  const ctx = getJourneyContext();

  let firstGroupId: string | null = null;

  it('GET /api/v1/groups → 200 with array of groups', async () => {
    const res = await ctx.userA.get('/api/v1/groups');
    expect(res.status).toBe(200);

    const body = res.body as { success: boolean; data: GroupItem[] };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);

    if (body.data.length > 0) {
      firstGroupId = body.data[0]!.id;
    }
  });

  it('each group has required fields', async () => {
    const res = await ctx.userA.get('/api/v1/groups');
    const body = res.body as { success: boolean; data: GroupItem[] };

    for (const group of body.data) {
      expect(typeof group.id).toBe('string');
      expect(typeof group.name).toBe('string');
      expect(['REGIONAL', 'CULTURAL', 'PROFESSIONAL', 'INTEREST']).toContain(group.type);
      expect(typeof group.memberCount).toBe('number');
    }
  });

  it('GET /api/v1/groups/suggested → 200', async () => {
    const res = await ctx.userA.get('/api/v1/groups/suggested');
    expect(res.status).toBe(200);
    const body = res.body as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('GET /api/v1/groups/:groupId → 200 for a known group', async () => {
    if (!firstGroupId) {
      console.warn('[e2e] Skipping — no groups found');
      return;
    }
    const res = await ctx.userA.get(`/api/v1/groups/${firstGroupId}`);
    expect(res.status).toBe(200);
    const body = res.body as { success: boolean; data: GroupItem };
    expect(body.data.id).toBe(firstGroupId);
  });

  it('GET /api/v1/groups/:groupId/members → 200', async () => {
    if (!firstGroupId) {
      console.warn('[e2e] Skipping — no groups found');
      return;
    }
    const res = await ctx.userA.get(`/api/v1/groups/${firstGroupId}/members`);
    expect(res.status).toBe(200);
    const body = res.body as { success: boolean; data: unknown };
    expect(body.success).toBe(true);
  });

  it('GET /api/v1/groups/unknown-uuid → 404', async () => {
    const res = await ctx.userA.get('/api/v1/groups/00000000-0000-0000-0000-000000000000');
    expect(res.status).toBe(404);
  });
});
