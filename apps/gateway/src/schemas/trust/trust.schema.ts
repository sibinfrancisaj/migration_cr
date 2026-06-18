import { z } from 'zod';
import { FlagReason } from '@abroad-matrimony/shared';

export const blockUserSchema = z.object({
  userId: z.string().uuid('userId must be a valid UUID'),
  reason: z.string().max(500).optional(),
});

export const userIdParamSchema = z.object({
  userId: z.string().uuid('userId must be a valid UUID'),
});

export const reportUserSchema = z.object({
  targetUserId: z.string().uuid('targetUserId must be a valid UUID'),
  reason: z.nativeEnum(FlagReason),
  description: z.string().max(1000).optional(),
});

export const privacyControlsSchema = z.object({
  showPhotosBeforeMutual:  z.boolean().optional(),
  showBioBeforeMutual:     z.boolean().optional(),
  showAnswersBeforeMutual: z.boolean().optional(),
}).refine(
  (d) => d.showPhotosBeforeMutual !== undefined || d.showBioBeforeMutual !== undefined || d.showAnswersBeforeMutual !== undefined,
  { message: 'At least one privacy setting must be provided' },
);

export type BlockUserBody = z.infer<typeof blockUserSchema>;
export type UserIdParams = z.infer<typeof userIdParamSchema>;
export type ReportUserBody = z.infer<typeof reportUserSchema>;
export type PrivacyControlsBody = z.infer<typeof privacyControlsSchema>;
