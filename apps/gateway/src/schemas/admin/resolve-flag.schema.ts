import { z } from 'zod';
import { FlagAction } from '@abroad-matrimony/shared';

/**
 * PUT /admin/flags/:flagId
 *
 * Resolve or dismiss a moderation flag.
 */
export const resolveFlagBodySchema = z.object({
  status: z.enum(['RESOLVED', 'DISMISSED']),
  actionTaken: z.nativeEnum(FlagAction).optional(),
  resolution: z.string().trim().max(1000).optional(),
});

export type ResolveFlagBody = z.infer<typeof resolveFlagBodySchema>;

/**
 * GET /admin/users/:userId/flags
 * Optional query: ?page=1&limit=20
 */
export const adminFlagsQuerySchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type AdminFlagsQuery = z.infer<typeof adminFlagsQuerySchema>;
