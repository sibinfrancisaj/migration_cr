import { z } from 'zod';
import { RealLifeQuestionKey } from '@abroad-matrimony/shared';

// ── Route params schema ───────────────────────────────────────────────────────

export const realLifeAnswerParamsSchema = z.object({
  questionKey: z.nativeEnum(RealLifeQuestionKey, {
    required_error: 'Question key is required.',
    invalid_type_error:
      `Invalid questionKey. Must be one of: ${Object.values(RealLifeQuestionKey).join(', ')}.`,
  }),
});

export type RealLifeAnswerParams = z.infer<typeof realLifeAnswerParamsSchema>;

// ── Request body schema ───────────────────────────────────────────────────────

export const upsertRealLifeAnswerSchema = z.object({
  value: z.union(
    [
      z.string({ required_error: 'Answer value is required.' })
        .min(1, 'Answer cannot be empty.')
        .max(500, 'Answer must not exceed 500 characters.'),
      z.array(
        z.string().min(1, 'Each answer item cannot be empty.').max(200),
        { required_error: 'Answer value is required.' },
      )
        .min(1, 'Answer array cannot be empty.')
        .max(20, 'Answer array must not exceed 20 items.'),
    ],
    {
      required_error: 'Answer value is required.',
      invalid_type_error: 'Answer value must be a string or array of strings.',
    },
  ),
});

export type UpsertRealLifeAnswerBody = z.infer<typeof upsertRealLifeAnswerSchema>;
