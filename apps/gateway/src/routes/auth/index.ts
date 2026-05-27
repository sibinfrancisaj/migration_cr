import { Router } from 'express';
import { validateBody } from '../../middleware/validate.middleware.js';
import { otpRequestSchema } from '../../schemas/auth/otp-request.schema.js';
import { otpVerifySchema } from '../../schemas/auth/otp-verify.schema.js';
import { tokenRefreshSchema } from '../../schemas/auth/token-refresh.schema.js';
import { otpController } from '../../controllers/auth/otp.controller.js';
import { tokenController } from '../../controllers/auth/token.controller.js';

export const authRouter = Router();

authRouter.post('/otp/request', validateBody(otpRequestSchema), otpController.requestOtp);
authRouter.post('/otp/verify', validateBody(otpVerifySchema), otpController.verifyOtp);
authRouter.post('/token/refresh', validateBody(tokenRefreshSchema), tokenController.refreshToken);
