import { z } from 'zod';

export const razorpayCaptureBodySchema = z.object({
  razorpayOrderId:   z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
});

export type RazorpayCaptureBody = z.infer<typeof razorpayCaptureBodySchema>;
