/**
 * ADMIN-005 — Audit log viewer service.
 * Read-only access to the tamper-evident admin audit trail.
 */
import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';

const log = createChildLogger({ module: 'auth:audit-log-admin' });

export interface AuditLogQuery {
  adminId?: string;
  action?: string;
  entity?: string;
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
}

export interface AuditLogEntryDto {
  id: string;
  adminId: string;
  adminEmail: string | null;
  action: string;
  entity: string;
  entityId: string;
  before: unknown;
  after: unknown;
  ipAddress: string;
  userAgent: string | null;
  createdAt: string;
}

export async function listAuditLogs(query: AuditLogQuery): Promise<{
  entries: AuditLogEntryDto[];
  hasMore: boolean;
  nextCursor: string | null;
}> {
  const limit = Math.min(query.limit ?? 50, 200);

  const entries = await prisma.auditLog.findMany({
    where: {
      ...(query.adminId ? { adminUserId: query.adminId } : {}),
      ...(query.action   ? { action: { contains: query.action, mode: 'insensitive' } } : {}),
      ...(query.entity   ? { entity: { contains: query.entity, mode: 'insensitive' } } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to   ? { lte: new Date(query.to)   } : {}),
            },
          }
        : {}),
      ...(query.cursor ? { id: { lt: query.cursor } } : {}),
    },
    include: {
      adminUser: { select: { email: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
  });

  const hasMore = entries.length > limit;
  const page = entries.slice(0, limit);

  log.info('Audit logs queried', { filters: query, returned: page.length });

  return {
    entries: page.map((e) => ({
      id: e.id,
      adminId: e.adminUserId,
      adminEmail: e.adminUser.email ?? null,
      action: e.action,
      entity: e.entity,
      entityId: e.entityId,
      before: e.before,
      after: e.after,
      ipAddress: e.ipAddress,
      userAgent: e.userAgent,
      createdAt: e.createdAt.toISOString(),
    })),
    hasMore,
    nextCursor: hasMore ? page[page.length - 1]!.id : null,
  };
}
