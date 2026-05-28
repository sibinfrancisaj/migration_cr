import { Router } from 'express';
import { requireAdminRole } from '@abroad-matrimony/auth';
import { AdminRole } from '@abroad-matrimony/shared';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.middleware.js';
import { adminLoginSchema } from '../../schemas/admin/admin-login.schema.js';
import { adminAuthController } from '../../controllers/admin/admin-auth.controller.js';
import { flagsController } from '../../controllers/admin/flags.controller.js';
import { paymentAdminController } from '../../controllers/admin/payment-admin.controller.js';
import { resolveFlagBodySchema, adminFlagsQuerySchema } from '../../schemas/admin/resolve-flag.schema.js';
import { adminRefundBodySchema } from '../../schemas/payment/admin-refund.schema.js';
import { z } from 'zod';

const userIdParamsSchema = z.object({ userId: z.string().uuid('userId must be a valid UUID') });
const flagIdParamsSchema = z.object({ flagId: z.string().uuid('flagId must be a valid UUID') });

export const adminRouter = Router();

// Public — no auth required for the login endpoint itself
adminRouter.post('/auth/login', validateBody(adminLoginSchema), adminAuthController.login);

/**
 * GET /admin/users/:userId/flags?page=1&limit=20
 * List moderation flags for a specific user. Requires MODERATOR role or higher.
 */
adminRouter.get(
  '/users/:userId/flags',
  requireAdminRole(AdminRole.MODERATOR),
  validateParams(userIdParamsSchema),
  validateQuery(adminFlagsQuerySchema),
  flagsController.listByUser,
);

/**
 * PUT /admin/flags/:flagId
 * Resolve or dismiss a moderation flag. Requires MODERATOR role or higher.
 */
adminRouter.put(
  '/flags/:flagId',
  requireAdminRole(AdminRole.MODERATOR),
  validateParams(flagIdParamsSchema),
  validateBody(resolveFlagBodySchema),
  flagsController.resolve,
);

/**
 * POST /admin/payment/refund
 * PAY-008: Record a payment refund and optionally reverse diamond credits.
 * Requires SUPERADMIN role.
 */
adminRouter.post(
  '/payment/refund',
  requireAdminRole(AdminRole.SUPERADMIN),
  validateBody(adminRefundBodySchema),
  paymentAdminController.refund,
);
