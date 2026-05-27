import { z } from 'zod';

export const tokenRefreshSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type TokenRefreshBody = z.infer<typeof tokenRefreshSchema>;
