import { prisma, Prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';

const log = createChildLogger({ module: 'auth:audit' });

export interface AuditLogInput {
  adminUserId: string;
  action: string;           // e.g. 'USER_SUSPENDED', 'VERIFICATION_APPROVED'
  entity: string;           // e.g. 'User', 'VerificationRequest'
  entityId: string;         // UUID of the affected record
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ipAddress: string;
  userAgent?: string;
}

/**
 * Writes an immutable audit log entry to the `audit_logs` table.
 *
 * This is fire-and-forget from the controller's perspective — but we DO await
 * so that write failures are surfaced rather than silently swallowed.
 * If the DB is unavailable the calling controller should decide whether to
 * abort the operation or log + continue.
 *
 * Note: `before` / `after` are stored as Prisma JSON.  Pass plain objects;
 * do NOT pass Prisma query results with circular references.
 */
export async function auditLog(input: AuditLogInput): Promise<void> {

  try {
    await prisma.auditLog.create({
      data: {
        adminUserId: input.adminUserId,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
        before: (input.before ?? undefined) as Prisma.InputJsonValue | undefined,
        after: (input.after ?? undefined) as Prisma.InputJsonValue | undefined,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    });
  } catch (err) {
    // Log the failure but re-throw so callers can decide whether to abort.
    log.error('Failed to write audit log entry', {
      adminUserId: input.adminUserId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      err,
    });
    throw err;
  }
}
