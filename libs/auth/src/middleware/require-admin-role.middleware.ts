import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import { AdminRole } from '@abroad-matrimony/shared';
import { verifyAdminToken } from '../jwt.service.js';

const log = createChildLogger({ module: 'auth:require-admin-role' });

/**
 * Express middleware that enforces a valid admin JWT and, optionally, a
 * specific set of AdminRole values.
 *
 * Usage:
 *   // Any authenticated admin
 *   router.get('/stats', requireAdminRole(), handler)
 *
 *   // SUPERADMIN only
 *   router.delete('/user/:id', requireAdminRole(AdminRole.SUPERADMIN), handler)
 *
 *   // OPS or SUPERADMIN
 *   router.post('/verify', requireAdminRole(AdminRole.SUPERADMIN, AdminRole.OPS), handler)
 *
 * On success: sets `req.admin = { id, role, email }` and calls next().
 *
 * Failure modes:
 *   401 — Authorization header missing/malformed, or token invalid/expired
 *   403 — token valid but admin's role is not in the allowed list
 */
export function requireAdminRole(...roles: AdminRole[]) {
  return function adminRoleGuard(req: Request, res: Response, next: NextFunction): void {
    const requestId = req.requestId;
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      log.warn('Missing or malformed admin Authorization header', { requestId });
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Admin authentication required.' },
        requestId,
      });
      return;
    }

    const token = authHeader.slice(7); // strip 'Bearer '
    const payload = verifyAdminToken(token);

    if (!payload) {
      log.warn('Invalid or expired admin token', { requestId });
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Admin authentication required.' },
        requestId,
      });
      return;
    }

    // Role check is skipped when no roles were specified (any admin is allowed)
    if (roles.length > 0 && !roles.includes(payload.role)) {
      log.warn('Forbidden: admin role not in allowed list', {
        requestId,
        adminId: payload.sub,
        adminRole: payload.role,
        requiredRoles: roles,
      });
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient admin permissions.' },
        requestId,
      });
      return;
    }

    req.admin = { id: payload.sub, role: payload.role, email: payload.email };
    next();
  };
}
