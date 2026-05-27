import type { Request, Response, NextFunction } from 'express';
import { requireRole } from '../middleware/require-role.middleware.js';
import { UserRole } from '@abroad-matrimony/shared';

// ── Logger mock ───────────────────────────────────────────────────────────────

jest.mock('@abroad-matrimony/logger', () => ({
  createChildLogger: () => ({
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
  }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildReq(overrides: Partial<Request> = {}): Request {
  return {
    requestId: 'test-req-id',
    path: '/test',
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

describe('requireRole middleware', () => {
  let next: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    next = jest.fn();
  });

  // ── 401 — req.user not set ─────────────────────────────────────────────────

  describe('when req.user is not set (requireAuth missing from chain)', () => {
    it('returns 401 UNAUTHORIZED', () => {
      const req = buildReq(); // no req.user
      const res = buildRes();
      const middleware = requireRole(UserRole.USER);

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: 'UNAUTHORIZED' }),
        }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('includes requestId in the 401 response', () => {
      const req = buildReq({ requestId: 'abc-123' } as any);
      const res = buildRes();
      requireRole(UserRole.USER)(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ requestId: 'abc-123' }),
      );
    });
  });

  // ── 403 — role not in allowed list ─────────────────────────────────────────

  describe('when req.user.role is not in the allowed list', () => {
    it('returns 403 FORBIDDEN for single-role guard', () => {
      const req = buildReq({
        user: { id: 'u1', role: UserRole.USER, deviceId: 'd1' },
      } as any);
      const res = buildRes();
      const middleware = requireRole(UserRole.VERIFIED); // USER is not VERIFIED

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({ code: 'FORBIDDEN' }),
        }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 403 when user role is not in a multi-role allowed list', () => {
      const req = buildReq({
        user: { id: 'u1', role: UserRole.USER, deviceId: 'd1' },
      } as any);
      const res = buildRes();
      const middleware = requireRole(UserRole.VERIFIED, UserRole.FOUNDING_MEMBER);

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 403 for a SUSPENDED user even if role matches', () => {
      const req = buildReq({
        user: { id: 'u1', role: UserRole.SUSPENDED, deviceId: 'd1' },
      } as any);
      const res = buildRes();
      // requireRole(USER) — SUSPENDED is not USER
      const middleware = requireRole(UserRole.USER);

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });
  });

  // ── 200 / next() — role allowed ────────────────────────────────────────────

  describe('when req.user.role is in the allowed list', () => {
    it('calls next() for an exact single-role match', () => {
      const req = buildReq({
        user: { id: 'u1', role: UserRole.VERIFIED, deviceId: 'd1' },
      } as any);
      const res = buildRes();
      const middleware = requireRole(UserRole.VERIFIED);

      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('calls next() when user role matches one of many allowed roles', () => {
      const req = buildReq({
        user: { id: 'u1', role: UserRole.FOUNDING_MEMBER, deviceId: 'd1' },
      } as any);
      const res = buildRes();
      const middleware = requireRole(UserRole.VERIFIED, UserRole.FOUNDING_MEMBER);

      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('calls next() for USER role when USER is explicitly allowed', () => {
      const req = buildReq({
        user: { id: 'u1', role: UserRole.USER, deviceId: 'd1' },
      } as any);
      const res = buildRes();
      requireRole(UserRole.USER)(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('does not mutate req.user', () => {
      const user = { id: 'u1', role: UserRole.VERIFIED, deviceId: 'd1' };
      const req = buildReq({ user } as any);
      const res = buildRes();
      requireRole(UserRole.VERIFIED)(req, res, next);

      expect((req as any).user).toBe(user); // same reference, not mutated
    });
  });
});
