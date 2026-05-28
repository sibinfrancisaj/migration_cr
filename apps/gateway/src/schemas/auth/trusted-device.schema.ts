import { z } from 'zod';

/**
 * Body for POST /api/v1/auth/trusted-device
 *
 * The client sends the phone number and the UUID it generated on first install
 * and persisted in Keychain (iOS) or SharedPreferences (Android).
 * The server never generates or supplies this UUID.
 */
export const trustedDeviceBodySchema = z.object({
  phone: z
    .string()
    .regex(/^\+[1-9]\d{7,14}$/, 'phone must be a valid E.164 number (e.g. +919876543210)'),

  deviceFingerprint: z
    .string()
    .uuid('deviceFingerprint must be a valid UUID v4'),
});

export type TrustedDeviceBody = z.infer<typeof trustedDeviceBodySchema>;
