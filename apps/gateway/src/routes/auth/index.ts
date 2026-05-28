import { Router } from 'express';
import { requireAuth } from '@abroad-matrimony/auth';
import { validateBody } from '../../middleware/validate.middleware.js';
import { otpRequestSchema } from '../../schemas/auth/otp-request.schema.js';
import { otpVerifySchema } from '../../schemas/auth/otp-verify.schema.js';
import { tokenRefreshSchema } from '../../schemas/auth/token-refresh.schema.js';
import { trustedDeviceBodySchema } from '../../schemas/auth/trusted-device.schema.js';
import { otpController } from '../../controllers/auth/otp.controller.js';
import { tokenController } from '../../controllers/auth/token.controller.js';
import { logoutController } from '../../controllers/auth/logout.controller.js';
import { firebaseTokenController } from '../../controllers/auth/firebase-token.controller.js';
import { trustedDeviceController } from '../../controllers/auth/trusted-device.controller.js';

export const authRouter = Router();

// Public routes
authRouter.post('/otp/request', validateBody(otpRequestSchema), otpController.requestOtp);
authRouter.post('/otp/verify', validateBody(otpVerifySchema), otpController.verifyOtp);
authRouter.post('/token/refresh', validateBody(tokenRefreshSchema), tokenController.refreshToken);

/**
 * POST /api/v1/auth/trusted-device
 * Re-issues a JWT pair for a returning user whose device is within its trust window.
 * No Twilio OTP required — saves SMS cost.
 * Returns 401 DEVICE_NOT_TRUSTED when trust is absent/expired → client starts OTP flow.
 */
authRouter.post('/trusted-device', validateBody(trustedDeviceBodySchema), trustedDeviceController.login);

// Protected routes (require valid access token)
authRouter.post('/logout', requireAuth, logoutController.logout);
authRouter.post('/logout/all', requireAuth, logoutController.logoutAll);

/**
 * GET /api/v1/auth/firebase-token
 * Issues a Firebase custom auth token for Flutter clients (MSG-003).
 * Flutter exchanges this for a Firebase ID token via signInWithCustomToken().
 */
authRouter.get('/firebase-token', requireAuth, firebaseTokenController.getToken);
