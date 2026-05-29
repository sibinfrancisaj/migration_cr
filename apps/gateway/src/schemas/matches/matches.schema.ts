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

export type SetMatchTuningBody = z.infer<typeof setMatchTuningSchema>;
