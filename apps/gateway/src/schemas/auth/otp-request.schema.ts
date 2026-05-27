import { z } from 'zod';

export const otpRequestSchema = z.object({
  phone: z
    .string()
    .regex(/^\+[1-9]\d{1,14}$/, 'Phone must be in E.164 format (e.g. +919876543210)'),
});

export type OtpRequestBody = z.infer<typeof otpRequestSchema>;
