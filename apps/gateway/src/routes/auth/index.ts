import { Router } from 'express';
import { requireAuth } from '@abroad-matrimony/auth';
import { validateBody } from '../../middleware/validate.middleware.js';
import { otpRequestSchema } from '../../schemas/auth/otp-request.schema.js';
import { otpVerifySchema } from '../../schemas/auth/otp-verify.schema.js';
import { tokenRefreshSchema } from '../../schemas/auth/token-refresh.schema.js';
import { otpController } from '../../controllers/auth/otp.controller.js';
import { tokenController } from '../../controllers/auth/token.controller.js';
import { logoutController } from '../../controllers/auth/logout.controller.js';

export const authRouter = Router();

// Public routes
authRouter.post('/otp/request', validateBody(otpRequestSchema), otpController.requestOtp);
authRouter.post('/otp/verify', validateBody(otpVerifySchema), otpController.verifyOtp);
authRouter.post('/token/refresh', validateBody(tokenRefreshSchema), tokenController.refreshToken);

// Protected routes (require valid access token)
authRouter.post('/logout', requireAuth, logoutController.logout);
authRouter.post('/logout/all', requireAuth, logoutController.logoutAll);
