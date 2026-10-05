/**
 * E2E environment variables.
 *
 * Required when E2E_ENABLED=true:
 *   E2E_GATEWAY_URL    — base URL of the running gateway (default http://localhost:3000)
 *   E2E_SEEDER_SECRET  — must match the gateway's SEEDER_SECRET env var
 *
 * Optional:
 *   E2E_ADMIN_USER_ID  — UUID of a SUPERADMIN user for admin journey tests
 *                        (auto-discovered from DB if not set)
 *   E2E_USER_A_ID      — UUID of seeded regular user A (auto-discovered if not set)
 *   E2E_USER_B_ID      — UUID of seeded regular user B (auto-discovered if not set)
 */

export interface E2eEnv {
  gatewayUrl: string;
  seederSecret: string;
  adminUserId: string | null;
  userAId: string | null;
  userBId: string | null;
}

export function getE2eEnv(): E2eEnv {
  return {
    gatewayUrl:   process.env['E2E_GATEWAY_URL']   ?? 'http://localhost:3000',
    seederSecret: process.env['E2E_SEEDER_SECRET'] ?? '',
    adminUserId:  process.env['E2E_ADMIN_USER_ID'] ?? null,
    userAId:      process.env['E2E_USER_A_ID']     ?? null,
    userBId:      process.env['E2E_USER_B_ID']     ?? null,
  };
}

export function isE2eEnabled(): boolean {
  return process.env['E2E_ENABLED'] === 'true';
}
