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

export type HabitKeyParams = z.infer<typeof habitKeyParamSchema>;
export type LogHabitBody = z.infer<typeof logHabitSchema>;
export type DeleteHabitLogParams = z.infer<typeof deleteHabitLogParamSchema>;
export type HabitReflectionBody = z.infer<typeof habitReflectionSchema>;
