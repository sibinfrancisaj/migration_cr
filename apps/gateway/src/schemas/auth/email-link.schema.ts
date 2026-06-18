import { z } from 'zod';

export const sendEmailLinkSchema = z.object({
  email: z.string().email('Must be a valid email address'),
});

export const verifyEmailLinkSchema = z.object({
  token: z.string().min(64, 'Invalid token format'),
  deviceId: z.string().uuid('deviceId must be a valid UUID'),
});

export type SendEmailLinkBody = z.infer<typeof sendEmailLinkSchema>;
export type VerifyEmailLinkBody = z.infer<typeof verifyEmailLinkSchema>;
