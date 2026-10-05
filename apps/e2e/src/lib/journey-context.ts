/**
 * Provides typed test context (clients + user IDs) for journey tests.
 * Call getJourneyContext() at the top of each describe block.
 */

import { getE2eEnv, isE2eEnabled } from './env.js';
import { makeClient, makeAnonClient, type E2eClient } from './api-client.js';
import { makeAuthHeader, makeAdminAuthHeader } from './auth.js';

export interface JourneyContext {
  anon:       E2eClient;   // no auth — for public endpoints
  userA:      E2eClient;   // authenticated as seeded user A (MEMBER)
  userB:      E2eClient;   // authenticated as seeded user B (MEMBER)
  admin:      E2eClient;   // authenticated as SUPERADMIN
  userAId:    string;
  userBId:    string;
  adminUserId: string | null;
  gatewayUrl: string;
}

export function getJourneyContext(): JourneyContext {
  const env = getE2eEnv();

  const userAId    = env.userAId    ?? process.env['E2E_USER_A_ID']     ?? '';
  const userBId    = env.userBId    ?? process.env['E2E_USER_B_ID']     ?? '';
  const adminUserId = env.adminUserId ?? process.env['E2E_ADMIN_USER_ID'] ?? null;

  const base = env.gatewayUrl;

  return {
    anon:       makeAnonClient(base),
    userA:      makeClient(base, makeAuthHeader(env.seederSecret, userAId)),
    userB:      makeClient(base, makeAuthHeader(env.seederSecret, userBId)),
    admin:      adminUserId
                  ? makeClient(base, makeAdminAuthHeader(env.seederSecret, adminUserId))
                  : makeAnonClient(base),
    userAId,
    userBId,
    adminUserId,
    gatewayUrl: base,
  };
}

/**
 * Skips the entire describe block when E2E_ENABLED is not set.
 * Wrap every journey file's top-level describe with this.
 */
export const describeE2e: jest.Describe =
  isE2eEnabled() ? describe : describe.skip;
