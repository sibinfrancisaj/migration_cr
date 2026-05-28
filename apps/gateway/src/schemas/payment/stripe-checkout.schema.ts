import { z } from 'zod';

export const stripeCheckoutBodySchema = z.object({
  /** Optional customer email forwarded to Stripe for pre-filling checkout form */
  email: z.string().email().optional(),
});

export type StripeCheckoutBody = z.infer<typeof stripeCheckoutBodySchema>;
