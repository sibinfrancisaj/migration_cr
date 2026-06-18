import { z } from 'zod';
import { HabitKey } from '@abroad-matrimony/shared';

export const habitKeyParamSchema = z.object({
  habitKey: z.nativeEnum(HabitKey),
});

export const logHabitSchema = z.object({
  logDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'logDate must be YYYY-MM-DD').optional(),
  notes: z.string().max(500).optional(),
  reflection: z.string().max(1000).optional(),
});

export const deleteHabitLogParamSchema = z.object({
  habitKey: z.nativeEnum(HabitKey),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
});

export const habitReflectionSchema = z.object({
  habitKey: z.nativeEnum(HabitKey),
  reflection: z.string().min(1).max(1000),
});

/** HABIT-007: query params for per-habit history endpoint. */
export const habitHistoryQuerySchema = z.object({
  weeks: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 8))
    .pipe(z.number().int().min(1).max(52)),
});

/** HABIT-006: body for summary visibility toggle. */
export const summaryVisibilitySchema = z.object({
  visible: z.boolean(),
});

export type HabitKeyParams = z.infer<typeof habitKeyParamSchema>;
export type LogHabitBody = z.infer<typeof logHabitSchema>;
export type DeleteHabitLogParams = z.infer<typeof deleteHabitLogParamSchema>;
export type HabitReflectionBody = z.infer<typeof habitReflectionSchema>;
export type HabitHistoryQuery = z.infer<typeof habitHistoryQuerySchema>;
export type SummaryVisibilityBody = z.infer<typeof summaryVisibilitySchema>;
