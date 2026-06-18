import { z } from 'zod';

export const setMatchTuningSchema = z.object({
  weights: z.record(
    z.string(),
    z.number().min(0.1).max(3.0),
  ).refine(
    (w) => Object.keys(w).length > 0,
    { message: 'At least one weight must be provided' },
  ),
});

const importanceField = z.number().int().min(1).max(5);

/** Simplified 2-question tuning body (ALG-011). */
export const matchTuningQuestionsSchema = z.object({
  settlementImportance: importanceField,
  familyImportance:     importanceField,
});

/** Impact preview query params (ALG-012). */
export const tuningImpactQuerySchema = z.object({
  settlementImportance: z.coerce.number().int().min(1).max(5),
  familyImportance:     z.coerce.number().int().min(1).max(5),
});

export type SetMatchTuningBody = z.infer<typeof setMatchTuningSchema>;
export type MatchTuningQuestionsBody = z.infer<typeof matchTuningQuestionsSchema>;
export type TuningImpactQuery = z.infer<typeof tuningImpactQuerySchema>;
