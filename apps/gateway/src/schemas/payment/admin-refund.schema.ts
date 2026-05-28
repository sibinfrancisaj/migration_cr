import { z } from 'zod';

export const adminRefundBodySchema = z.object({
  /** Provider payment ID (Stripe checkout session ID or Razorpay payment ID) */
  providerPaymentId: z.string().min(1),
  /** Human-readable reason recorded in ledger metadata */
  reason: z.string().min(1).max(200),
  /** Non-negative diamond amount to reverse (0 if the payment had no diamond component) */
  diamondAmount: z.number().int().nonnegative().default(0),
  /** User ID required when diamondAmount > 0 to credit the diamond reversal */
  userId: z.string().uuid().optional(),
});

export type AdminRefundBody = z.infer<typeof adminRefundBodySchema>;
