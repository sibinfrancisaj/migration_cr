import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import { UserRole } from '@abroad-matrimony/shared';

const log = createChildLogger({ module: 'auth:require-role' });

/**
 * Factory middleware that enforces the authenticated user has one of the
 * specified roles.  Must be placed AFTER `requireAuth` in the middleware chain
 * (requireAuth sets `req.user`; this middleware reads it).
 *
 * Usage:
 *   router.post('/admin-only', requireAuth, requireRole(UserRole.SUPERADMIN), handler)
 *   router.post('/verified',   requireAuth, requireRole(UserRole.VERIFIED, UserRole.FOUNDING_MEMBER), handler)
 *
 * Failure modes:
 *   401 — req.user is absent (requireAuth was not applied before this middleware)
 *   403 — user is authenticated but their role is not in the allowed list
 */
export function requireRole(...roles: UserRole[]) {
  return function roleGuard(req: Request, res: Response, next: NextFunction): void {
    const requestId = req.requestId;

    if (!req.user) {
      log.warn('requireRole called but req.user is not set — requireAuth missing from chain', {
        requestId,
        path: req.path,
      });
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required.' },
        requestId,
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      log.warn('Forbidden: user role not in allowed list', {
        requestId,
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: roles,
      });
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions.' },
        requestId,
      });
      return;
    }

    next();
  };
}
