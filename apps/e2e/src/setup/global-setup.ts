/**
 * Jest globalSetup — runs once before all E2E journey tests.
 *
 * Only does the gateway liveness check here.
 * User ID auto-discovery happens in setup-test-users.ts (setupFilesAfterFramework)
 * which runs inside the Jest transform context where path aliases work.
 *
 * Skipped entirely when E2E_ENABLED !== 'true'.
 */

export default async function globalSetup(): Promise<void> {
  if (process.env['E2E_ENABLED'] !== 'true') {
    return;
  }

  const gatewayUrl = process.env['E2E_GATEWAY_URL'] ?? 'http://localhost:3000';

  if (!process.env['E2E_SEEDER_SECRET']) {
    throw new Error('[e2e] E2E_SEEDER_SECRET must be set when E2E_ENABLED=true');
  }

  console.log(`[e2e] Pinging gateway at ${gatewayUrl}/health ...`);
  try {
    const res = await fetch(`${gatewayUrl}/health`);
    if (!res.ok) throw new Error(`/health returned ${res.status}`);
    console.log('[e2e] Gateway is up ✓');
  } catch (err) {
    throw new Error(
      `[e2e] Gateway unreachable at ${gatewayUrl}. ` +
      `Start it with: cd apps/gateway && npm run dev\n${String(err)}`,
    );
  }
}
