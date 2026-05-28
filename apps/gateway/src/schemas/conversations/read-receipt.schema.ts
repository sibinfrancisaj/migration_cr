import { z } from 'zod';

/**
 * POST /conversations/:convId/read
 *
 * Marks all messages up to and including `lastReadMessageId` as read.
 */
export const readReceiptBodySchema = z.object({
  lastReadMessageId: z.string().uuid('lastReadMessageId must be a valid UUID'),
});

export type ReadReceiptBody = z.infer<typeof readReceiptBodySchema>;
