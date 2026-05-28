import { auditLog } from '../audit.service.js';

// ── DB mock ───────────────────────────────────────────────────────────────────

const mockAuditLogCreate = jest.fn();

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    auditLog: {
      create: (...args: unknown[]) => mockAuditLogCreate(...args),
    },
  },
  PrismaClient: jest.fn(),
  // Prisma namespace stub — InputJsonValue cast only needed at TS compile time
  Prisma: {},
}));

// ── Logger mock ───────────────────────────────────────────────────────────────

jest.mock('@abroad-matrimony/logger', () => ({
  createChildLogger: () => ({
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  }),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const BASE_INPUT = {
  adminUserId: 'admin-uuid-1',
  action: 'USER_SUSPENDED',
  entity: 'User',
  entityId: 'user-uuid-42',
  ipAddress: '192.168.1.1',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('auditLog()', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuditLogCreate.mockResolvedValue({ id: 'audit-uuid-1' });
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it('calls prisma.auditLog.create with the correct data', async () => {
    await auditLog(BASE_INPUT);

    expect(mockAuditLogCreate).toHaveBeenCalledTimes(1);
    expect(mockAuditLogCreate).toHaveBeenCalledWith({
      data: {
        adminUserId: 'admin-uuid-1',
        action: 'USER_SUSPENDED',
        entity: 'User',
        entityId: 'user-uuid-42',
        ipAddress: '192.168.1.1',
        before: undefined,
        after: undefined,
        userAgent: undefined,
      },
    });
  });

  it('passes before/after snapshots when provided', async () => {
    await auditLog({
      ...BASE_INPUT,
      before: { status: 'ACTIVE' },
      after: { status: 'SUSPENDED' },
    });

    expect(mockAuditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        before: { status: 'ACTIVE' },
        after: { status: 'SUSPENDED' },
      }),
    });
  });

  it('passes userAgent when provided', async () => {
    await auditLog({
      ...BASE_INPUT,
      userAgent: 'Mozilla/5.0',
    });

    expect(mockAuditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ userAgent: 'Mozilla/5.0' }),
    });
  });

  it('resolves without a return value on success', async () => {
    const result = await auditLog(BASE_INPUT);
    expect(result).toBeUndefined();
  });

  it('converts null before/after to undefined', async () => {
    await auditLog({
      ...BASE_INPUT,
      before: null,
      after: null,
    });

    expect(mockAuditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        before: undefined,
        after: undefined,
      }),
    });
  });

  // ── Error handling ────────────────────────────────────────────────────────

  it('re-throws when prisma.auditLog.create throws', async () => {
    mockAuditLogCreate.mockRejectedValueOnce(new Error('DB connection lost'));

    await expect(auditLog(BASE_INPUT)).rejects.toThrow('DB connection lost');
  });
});
