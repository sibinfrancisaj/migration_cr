import { z } from 'zod';

export const diamondPurchaseBodySchema = z.object({
  /** One of: DIAMONDS_50, DIAMONDS_100, DIAMONDS_200 */
  packageKey: z.string().min(1),
  /** Optional customer email for Stripe checkout pre-fill */
  email: z.string().email().optional(),
});

export type DiamondPurchaseBody = z.infer<typeof diamondPurchaseBodySchema>;
