import { z } from 'zod';

export const updateNotificationPreferenceSchema = z.object({
  emailEnabled:     z.boolean().optional(),
  smsEnabled:       z.boolean().optional(),
  pushEnabled:      z.boolean().optional(),
  marketingEnabled: z.boolean().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one preference field must be provided.' },
);

export type UpdateNotificationPreferenceBody = z.infer<typeof updateNotificationPreferenceSchema>;
