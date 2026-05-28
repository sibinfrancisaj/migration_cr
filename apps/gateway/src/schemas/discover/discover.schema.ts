import { z } from 'zod';
import { PAGINATION } from '@abroad-matrimony/shared';

/**
 * Validates query params for GET /api/v1/discover.
 *
 * - cursor: opaque base64url string from a previous response
 * - limit:  number of items per page (1–100, default 20)
 */
export const discoverQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(PAGINATION.MAX_PAGE_SIZE)
    .default(PAGINATION.DEFAULT_PAGE_SIZE),
});

export type DiscoverQuery = z.infer<typeof discoverQuerySchema>;
