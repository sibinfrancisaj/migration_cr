import { requireAuth } from '../../middleware/require-auth.middleware.js';
import type { Request, Response, NextFunction } from 'express';

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockVerifyAccessToken = jest.fn();

jest.mock('../../jwt.service.js', () => ({
  verifyAccessToken: (...args: unknown[]) => mockVerifyAccessToken(...args),
}));

jest.mock('@abroad-matrimony/shared', () => ({
  UserRole: { USER: 'USER', VERIFIED: 'VERIFIED', FOUNDING_MEMBER: 'FOUNDING_MEMBER', SUSPENDED: 'SUSPENDED' },
}));

// ── Helpers ───────────────────────────────────────────────────────────────

function buildReq(authHeader?: string): Partial<Request> {
  return {
    requestId: 'test-req-id',
    headers: authHeader ? { authorization: authHeader } : {},
  };
}

function buildRes(): { status: jest.Mock; json: jest.Mock } {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return { status, json };
}

// ── Tests ─────────────────────────────────────────────────────────────────

const VALID_PAYLOAD = { sub: 'user-1', role: 'USER', deviceId: 'device-1' };

describe('requireAuth middleware', () => {
  let next: jest.Mock<NextFunction>;

  beforeEach(() => {
    jest.clearAllMocks();
    next = jest.fn();
  });

  describe('success path', () => {
    it('attaches req.user and calls next() for a valid token', () => {
      mockVerifyAccessToken.mockReturnValue(VALID_PAYLOAD);
      const req = buildReq('Bearer valid.token.here') as Request;
      const res = buildRes() as unknown as Response;

      requireAuth(req, res, next);

      expect(next).toHaveBeenCalledWith(/* no args */);
      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user).toEqual({ id: 'user-1', role: 'USER', deviceId: 'device-1' });
    });

    it('maps JWT sub → req.user.id correctly', () => {
      mockVerifyAccessToken.mockReturnValue({ sub: 'uuid-abc', role: 'VERIFIED', deviceId: 'dev-xyz' });
      const req = buildReq('Bearer sometoken') as Request;
      const res = buildRes() as unknown as Response;

      requireAuth(req, res, next);

      expect(req.user?.id).toBe('uuid-abc');
      expect(req.user?.role).toBe('VERIFIED');
      expect(req.user?.deviceId).toBe('dev-xyz');
    });
  });

  describe('401 cases', () => {
    it('returns 401 when Authorization header is missing', () => {
      const req = buildReq() as Request;
      const res = buildRes() as unknown as Response;

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 when Authorization header has wrong scheme', () => {
      const req = buildReq('Basic dXNlcjpwYXNz') as Request;
      const res = buildRes() as unknown as Response;

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 when token is invalid or expired', () => {
      mockVerifyAccessToken.mockReturnValue(null);
      const req = buildReq('Bearer expired.token') as Request;
      const res = buildRes() as unknown as Response;

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('does not attach req.user on auth failure', () => {
      mockVerifyAccessToken.mockReturnValue(null);
      const req = buildReq('Bearer bad.token') as Request;
      const res = buildRes() as unknown as Response;

      requireAuth(req, res, next);

      expect(req.user).toBeUndefined();
    });
  });

  describe('403 — suspended user', () => {
    it('returns 403 when user role is SUSPENDED', () => {
      mockVerifyAccessToken.mockReturnValue({ sub: 'user-2', role: 'SUSPENDED', deviceId: 'dev-1' });
      const req = buildReq('Bearer suspended.token') as Request;
      const res = buildRes() as unknown as Response;

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();
    });

    it('does not attach req.user for suspended users', () => {
      mockVerifyAccessToken.mockReturnValue({ sub: 'user-2', role: 'SUSPENDED', deviceId: 'dev-1' });
      const req = buildReq('Bearer suspended.token') as Request;
      const res = buildRes() as unknown as Response;

      requireAuth(req, res, next);

      expect(req.user).toBeUndefined();
    });

    it('returns FORBIDDEN error code in response body for suspended users', () => {
      mockVerifyAccessToken.mockReturnValue({ sub: 'user-2', role: 'SUSPENDED', deviceId: 'dev-1' });
      const req = buildReq('Bearer suspended.token') as Request;
      const json = jest.fn();
      const res = { status: jest.fn().mockReturnValue({ json }), headers: {} } as unknown as Response;

      requireAuth(req, res, next);

      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.objectContaining({ code: 'FORBIDDEN' }) }),
      );
    });
  });
});
