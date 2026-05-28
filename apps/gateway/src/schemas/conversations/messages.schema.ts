import { z } from 'zod';
import { MESSAGING_LIMITS } from '../../constants/messaging.constants.js';

/**
 * Query params for GET /api/v1/conversations/:convId/messages
 */
export const messagesQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z
    .coerce.number()
    .int()
    .min(1)
    .max(MESSAGING_LIMITS.MAX_MESSAGES_PER_PAGE)
    .default(MESSAGING_LIMITS.DEFAULT_MESSAGES_PER_PAGE),
});

export type MessagesQuery = z.infer<typeof messagesQuerySchema>;

/**
 * Path params for routes that include :convId
 */
export const convIdParamsSchema = z.object({
  convId: z.string().uuid({ message: 'convId must be a valid UUID' }),
});

export type ConvIdParams = z.infer<typeof convIdParamsSchema>;
