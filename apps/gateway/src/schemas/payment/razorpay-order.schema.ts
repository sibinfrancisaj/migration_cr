import { z } from 'zod';

export const razorpayOrderBodySchema = z.object({
  /** Amount in paise — must match the selected plan / package */
  amountPaise: z.number().int().positive(),
});

export type RazorpayOrderBody = z.infer<typeof razorpayOrderBodySchema>;
