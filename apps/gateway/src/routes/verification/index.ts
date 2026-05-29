import { Router } from 'express';
import { requireAuth } from '@abroad-matrimony/auth';
import { validateBody, validateQuery } from '../../middleware/validate.middleware.js';
import {
  submitVerificationSchema,
  verificationUploadUrlSchema,
} from '../../schemas/verification/verification.schema.js';
import { verificationController } from '../../controllers/verification/verification.controller.js';

export const verificationRouter = Router();

verificationRouter.use(requireAuth);

/**
 * GET /api/v1/verification/upload-url?fileType=...&mimeType=...
 * Get a pre-signed URL for uploading a verification document or selfie.
 */
verificationRouter.get(
  '/upload-url',
  validateQuery(verificationUploadUrlSchema),
  verificationController.getUploadUrl,
);

/**
 * POST /api/v1/verification
 * Submit identity verification with pre-uploaded S3 keys.
 */
verificationRouter.post(
  '/',
  validateBody(submitVerificationSchema),
  verificationController.submit,
);

/**
 * GET /api/v1/verification/status
 * Get the authenticated user's current verification status.
 */
verificationRouter.get('/status', verificationController.getStatus);

/**
 * GET /api/v1/verification/trust-score
 * Get the authenticated user's trust score.
 */
verificationRouter.get('/trust-score', verificationController.getTrustScore);
