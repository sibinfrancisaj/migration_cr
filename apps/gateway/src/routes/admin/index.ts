import { Router } from 'express';
import { validateBody } from '../../middleware/validate.middleware.js';
import { adminLoginSchema } from '../../schemas/admin/admin-login.schema.js';
import { adminAuthController } from '../../controllers/admin/admin-auth.controller.js';

export const adminRouter = Router();

// Public — no auth required for the login endpoint itself
adminRouter.post('/auth/login', validateBody(adminLoginSchema), adminAuthController.login);
