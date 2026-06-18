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

export const addNoteSchema = z.object({
  notes: z.string().max(500, 'Notes must be 500 characters or less'),
});

export const compareQuerySchema = z.object({
  ids: z
    .string()
    .transform((val) => val.split(',').map((id) => id.trim()))
    .pipe(
      z.array(z.string().uuid('Each id must be a valid UUID')).min(2, 'At least 2 profile IDs required').max(3, 'At most 3 profile IDs allowed'),
    ),
});

export type SaveProfileBody = z.infer<typeof saveProfileSchema>;
export type SavedUserIdParams = z.infer<typeof savedUserIdParamSchema>;
export type UpdateSavedProfileBody = z.infer<typeof updateSavedProfileSchema>;
export type ListSavedQuery = z.infer<typeof listSavedQuerySchema>;
export type AddNoteBody = z.infer<typeof addNoteSchema>;
export type CompareQuery = z.infer<typeof compareQuerySchema>;
