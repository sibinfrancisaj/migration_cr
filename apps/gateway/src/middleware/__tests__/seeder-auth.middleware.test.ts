import type { Request, Response, NextFunction } from 'express';
import { buildSeederToken, seederAuthMiddleware } from '../seeder-auth.middleware.js';

// ── Config mock ────────────────────────────────────────────────────────────────
const mockEnv = {
  NODE_ENV: 'development' as 'development' | 'test' | 'staging' | 'production',
  SEEDER_SECRET: 'test-seeder-secret-min-32-chars!!',
};

jest.mock('@abroad-matrimony/config', () => ({
  getEnv: () => mockEnv,
}));

jest.mock('@abroad-matrimony/logger', () => ({
  createChildLogger: () => ({ debug: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeReq(authHeader?: string): Partial<Request> & { user?: any } {
  return { headers: authHeader ? { authorization: authHeader } : {} } as any;
}

function makeRes(): Partial<Response> {
  return {} as any;
}

const next: NextFunction = jest.fn();

beforeEach(() => jest.clearAllMocks());

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('seederAuthMiddleware', () => {
  describe('development mode with SEEDER_SECRET set', () => {
    it('sets req.user when token is valid', () => {
      const token = buildSeederToken(mockEnv.SEEDER_SECRET, {
        userId: 'user-aaa',
        role: 'USER',
        deviceId: 'device-bbb',
      });
      const req = makeReq(`Bearer ${token}`);

      seederAuthMiddleware(req as Request, makeRes() as Response, next);

      expect(req.user).toEqual({ id: 'user-aaa', role: 'USER', deviceId: 'device-bbb' });
      expect(next).toHaveBeenCalledWith();
    });

    it('falls through when no Authorization header', () => {
      const req = makeReq();

      seederAuthMiddleware(req as Request, makeRes() as Response, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalledWith();
    });

    it('falls through when Authorization is not Bearer', () => {
      const req = makeReq('Basic dXNlcjpwYXNz');

      seederAuthMiddleware(req as Request, makeRes() as Response, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalledWith();
    });

    it('falls through (not errors) when token secret does not match', () => {
      // A normal JWT token would arrive here — seeder middleware must pass it through
      const req = makeReq('Bearer some.jwt.token');

      seederAuthMiddleware(req as Request, makeRes() as Response, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalledWith();
    });

    it('falls through when token has correct secret but invalid base64 payload', () => {
      const req = makeReq(`Bearer ${mockEnv.SEEDER_SECRET}.!!!not-valid-base64`);

      seederAuthMiddleware(req as Request, makeRes() as Response, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalledWith();
    });

    it('falls through when payload is missing userId', () => {
      const encoded = Buffer.from(JSON.stringify({ role: 'USER' })).toString('base64url');
      const req = makeReq(`Bearer ${mockEnv.SEEDER_SECRET}.${encoded}`);

      seederAuthMiddleware(req as Request, makeRes() as Response, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalledWith();
    });

    it('defaults deviceId to seeder-device when not in payload', () => {
      const token = buildSeederToken(mockEnv.SEEDER_SECRET, { userId: 'u1', role: 'USER' });
      const req = makeReq(`Bearer ${token}`);

      seederAuthMiddleware(req as Request, makeRes() as Response, next);

      expect(req.user?.deviceId).toBe('seeder-device');
    });
  });

  describe('production mode', () => {
    beforeEach(() => {
      mockEnv.NODE_ENV = 'production';
    });

    afterEach(() => {
      mockEnv.NODE_ENV = 'development';
    });

    it('is a strict no-op in production — ignores valid seeder token', () => {
      const token = buildSeederToken(mockEnv.SEEDER_SECRET, { userId: 'u1', role: 'USER' });
      const req = makeReq(`Bearer ${token}`);

      seederAuthMiddleware(req as Request, makeRes() as Response, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe('SEEDER_SECRET not configured', () => {
    beforeEach(() => {
      (mockEnv as any).SEEDER_SECRET = undefined;
    });

    afterEach(() => {
      (mockEnv as any).SEEDER_SECRET = 'test-seeder-secret-min-32-chars!!';
    });

    it('falls through silently when SEEDER_SECRET is not set', () => {
      const req = makeReq('Bearer anything');

      seederAuthMiddleware(req as Request, makeRes() as Response, next);

      expect(req.user).toBeUndefined();
      expect(next).toHaveBeenCalledWith();
    });
  });
});

describe('buildSeederToken', () => {
  it('produces a token that the middleware accepts', () => {
    const token = buildSeederToken('my-secret', { userId: 'abc', role: 'USER', deviceId: 'dev1' });
    expect(token).toMatch(/^my-secret\./);
    // Decode and verify
    const parts = token.split('.');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
    expect(payload).toEqual({ userId: 'abc', role: 'USER', deviceId: 'dev1' });
  });
});
