import type { Request, Response, NextFunction } from 'express';
import { requireAdminRole } from '../middleware/require-admin-role.middleware.js';
import { AdminRole } from '@abroad-matrimony/shared';

// ── Logger mock ───────────────────────────────────────────────────────────────

jest.mock('@abroad-matrimony/logger', () => ({
  createChildLogger: () => ({
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  }),
}));

// ── JWT service mock ──────────────────────────────────────────────────────────

const mockVerifyAdminToken = jest.fn();

jest.mock('../jwt.service.js', () => ({
  verifyAdminToken: (...args: unknown[]) => mockVerifyAdminToken(...args),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const VALID_PAYLOAD = {
  sub: 'admin-uuid-1',
  role: AdminRole.SUPERADMIN,
  email: 'admin@abroadmatrimony.com',
  iat: 1000,
  exp: 2000,
};

function buildReq(overrides: Partial<Request> = {}): Request {
  return {
    requestId: 'test-req-id',
    headers: { authorization: 'Bearer valid.admin.token' },
    path: '/admin/test',
    ...overrides,
  } as unknown as Request;
}

function buildRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as unknown as Response & { status: jest.Mock; json: jest.Mock };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('requireAdminRole middleware', () => {
  let next: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    jest.clearAllMocks();
    next = jest.fn();
    mockVerifyAdminToken.mockReturnValue(VALID_PAYLOAD);
  });

  // ── 401 — missing / malformed Authorization header ────────────────────────

  describe('Authorization header missing or malformed', () => {
    it('returns 401 when Authorization header is absent', () => {
      const req = buildReq({ headers: {} } as any);
      const res = buildRes();
      requireAdminRole()(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: 'UNAUTHORIZED' }),
        }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 when Authorization header does not start with "Bearer "', () => {
      const req = buildReq({ headers: { authorization: 'Basic dXNlcjpwYXNz' } } as any);
      const res = buildRes();
      requireAdminRole()(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('does not call verifyAdminToken when header is missing', () => {
      const req = buildReq({ headers: {} } as any);
      const res = buildRes();
      requireAdminRole()(req, res, next);

      expect(mockVerifyAdminToken).not.toHaveBeenCalled();
    });
  });

  // ── 401 — invalid / expired token ─────────────────────────────────────────

  describe('invalid or expired admin token', () => {
    it('returns 401 when verifyAdminToken returns null', () => {
      mockVerifyAdminToken.mockReturnValueOnce(null);

      const req = buildReq();
      const res = buildRes();
      requireAdminRole()(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: 'UNAUTHORIZED' }),
        }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('strips "Bearer " and passes the raw token to verifyAdminToken', () => {
      const req = buildReq({
        headers: { authorization: 'Bearer my.admin.jwt' },
      } as any);
      const res = buildRes();
      requireAdminRole()(req, res, next);

      expect(mockVerifyAdminToken).toHaveBeenCalledWith('my.admin.jwt');
    });
  });

  // ── 403 — valid token but role not in allowed list ────────────────────────

  describe('role not in allowed list', () => {
    it('returns 403 FORBIDDEN when admin role is not in a single-role guard', () => {
      mockVerifyAdminToken.mockReturnValueOnce({
        ...VALID_PAYLOAD,
        role: AdminRole.ANALYST,
      });

      const req = buildReq();
      const res = buildRes();
      requireAdminRole(AdminRole.SUPERADMIN)(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: 'FORBIDDEN' }),
        }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 403 when admin role is not in a multi-role guard', () => {
      mockVerifyAdminToken.mockReturnValueOnce({
        ...VALID_PAYLOAD,
        role: AdminRole.MODERATOR,
      });

      const req = buildReq();
      const res = buildRes();
      requireAdminRole(AdminRole.SUPERADMIN, AdminRole.OPS)(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ── Happy paths ────────────────────────────────────────────────────────────

  describe('valid token and role allowed', () => {
    it('calls next() when no roles are specified (any admin is allowed)', () => {
      const req = buildReq();
      const res = buildRes();
      requireAdminRole()(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('sets req.admin from the token payload', () => {
      const req = buildReq();
      const res = buildRes();
      requireAdminRole()(req, res, next);

      expect((req as any).admin).toEqual({
        id: 'admin-uuid-1',
        role: AdminRole.SUPERADMIN,
        email: 'admin@abroadmatrimony.com',
      });
    });

    it('calls next() when admin role matches a single-role guard', () => {
      const req = buildReq();
      const res = buildRes();
      requireAdminRole(AdminRole.SUPERADMIN)(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('calls next() when admin role is one of several allowed roles', () => {
      mockVerifyAdminToken.mockReturnValueOnce({
        ...VALID_PAYLOAD,
        role: AdminRole.OPS,
      });

      const req = buildReq();
      const res = buildRes();
      requireAdminRole(AdminRole.SUPERADMIN, AdminRole.OPS)(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('includes requestId in 401 response', () => {
      const req = buildReq({
        headers: {},
        requestId: 'my-trace-id',
      } as any);
      const res = buildRes();
      requireAdminRole()(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ requestId: 'my-trace-id' }),
      );
    });
  });
});
