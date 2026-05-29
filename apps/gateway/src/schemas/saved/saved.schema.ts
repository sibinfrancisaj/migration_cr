import { z } from 'zod';
import { SavedProfileLabel } from '@abroad-matrimony/shared';

export const saveProfileSchema = z.object({
  savedUserId: z.string().uuid('savedUserId must be a valid UUID'),
  label: z.nativeEnum(SavedProfileLabel).default(SavedProfileLabel.INTERESTED),
  notes: z.string().max(500).optional(),
});

export const savedUserIdParamSchema = z.object({
  savedUserId: z.string().uuid('savedUserId must be a valid UUID'),
});

export const updateSavedProfileSchema = z.object({
  label: z.nativeEnum(SavedProfileLabel).optional(),
  notes: z.string().max(500).optional(),
}).refine((data) => data.label !== undefined || data.notes !== undefined, {
  message: 'At least one of label or notes must be provided',
});

export const listSavedQuerySchema = z.object({
  label: z.nativeEnum(SavedProfileLabel).optional(),
});

export type SaveProfileBody = z.infer<typeof saveProfileSchema>;
export type SavedUserIdParams = z.infer<typeof savedUserIdParamSchema>;
export type UpdateSavedProfileBody = z.infer<typeof updateSavedProfileSchema>;
export type ListSavedQuery = z.infer<typeof listSavedQuerySchema>;
