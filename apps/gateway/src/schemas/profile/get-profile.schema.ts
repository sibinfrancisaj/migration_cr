import { z } from 'zod';

// ── Route params schema ───────────────────────────────────────────────────────

export const profileIdParamsSchema = z.object({
  id: z.string().uuid('Profile ID must be a valid UUID.'),
});

export type ProfileIdParams = z.infer<typeof profileIdParamsSchema>;
