import { z } from 'zod';

export const otpVerifySchema = z.object({
  phone: z
    .string()
    .regex(/^\+[1-9]\d{1,14}$/, 'Phone must be in E.164 format (e.g. +919876543210)'),
  code: z
    .string()
    .regex(/^\d{6}$/, 'OTP must be exactly 6 digits'),
  deviceFingerprint: z
    .string()
    .min(8, 'Device fingerprint too short')
    .max(200, 'Device fingerprint too long'),
  deviceName: z.string().max(100).optional(),
  platform: z.string().max(50).optional(),
});

export type OtpVerifyBody = z.infer<typeof otpVerifySchema>;
