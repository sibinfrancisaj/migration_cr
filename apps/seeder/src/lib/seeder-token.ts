/**
 * Seeder token builder — mirrors the format expected by the gateway's
 * seeder-auth.middleware.ts (SEED-004 / ADR-014).
 *
 * Token format: `<SEEDER_SECRET>.<base64url-JSON-payload>`
 */

export interface SeederTokenPayload {
  userId: string;
  role: string;
  deviceId?: string;
}

export function buildSeederToken(secret: string, payload: SeederTokenPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${secret}.${encoded}`;
}
