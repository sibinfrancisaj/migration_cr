import { z } from 'zod';
import { FlagReason } from '@abroad-matrimony/shared';

/**
 * POST /messages/:msgId/flag
 *
 * Report a message for moderation.
 */
export const flagMessageBodySchema = z.object({
  reason: z.nativeEnum(FlagReason),
  description: z.string().trim().max(500).optional(),
});

export type FlagMessageBody = z.infer<typeof flagMessageBodySchema>;
