import { z } from 'zod';
import { Gender } from '@abroad-matrimony/shared';

// ── Age guard helper ──────────────────────────────────────────────────────────

function isAtLeast18(date: Date): boolean {
  const now = new Date();
  const eighteenYearsAgo = new Date(
    now.getFullYear() - 18,
    now.getMonth(),
    now.getDate(),
  );
  return date <= eighteenYearsAgo;
}

// ── Schema ────────────────────────────────────────────────────────────────────

export const createProfileSchema = z.object({
  name: z
    .string({ required_error: 'Name is required.' })
    .min(2, 'Name must be at least 2 characters.')
    .max(100, 'Name must not exceed 100 characters.')
    .trim(),

  dateOfBirth: z
    .coerce.date({
      required_error: 'Date of birth is required.',
      invalid_type_error: 'Date of birth must be a valid ISO 8601 date.',
    })
    .refine(isAtLeast18, { message: 'You must be at least 18 years old.' }),

  gender: z.nativeEnum(Gender, {
    required_error: 'Gender is required.',
    invalid_type_error: `Gender must be one of: ${Object.values(Gender).join(', ')}.`,
  }),

  currentCity: z
    .string({ required_error: 'Current city is required.' })
    .min(1, 'Current city is required.')
    .max(100, 'Current city must not exceed 100 characters.')
    .trim(),

  currentCountry: z
    .string({ required_error: 'Current country is required.' })
    .min(1, 'Current country is required.')
    .max(100, 'Current country must not exceed 100 characters.')
    .trim(),

  settlementIntent: z
    .string({ required_error: 'Settlement intent is required.' })
    .min(1, 'Settlement intent is required.')
    .max(200, 'Settlement intent must not exceed 200 characters.')
    .trim(),

  bio: z
    .string()
    .max(500, 'Bio must not exceed 500 characters.')
    .trim()
    .optional(),
});

export type CreateProfileBody = z.infer<typeof createProfileSchema>;
