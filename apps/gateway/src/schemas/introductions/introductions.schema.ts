import { z } from 'zod';

export const introIdParamSchema = z.object({
  introId: z.string().uuid('introId must be a valid UUID'),
});

export const introHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type IntroIdParams = z.infer<typeof introIdParamSchema>;
export type IntroHistoryQuery = z.infer<typeof introHistoryQuerySchema>;
