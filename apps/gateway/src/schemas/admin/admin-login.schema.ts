import { z } from 'zod';

export const adminLoginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required.' })
    .email('Invalid email address.'),
  password: z
    .string({ required_error: 'Password is required.' })
    .min(1, 'Password is required.'),
  totpCode: z
    .string()
    .length(6, 'TOTP code must be 6 digits.')
    .regex(/^\d{6}$/, 'TOTP code must contain only digits.')
    .optional(),
});

export type AdminLoginBody = z.infer<typeof adminLoginSchema>;
