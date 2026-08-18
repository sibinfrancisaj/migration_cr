import { z } from 'zod';

export const setPartnerPreferenceSchema = z.object({
  ageMin:    z.number().int().min(18).max(80).nullable().optional(),
  ageMax:    z.number().int().min(18).max(80).nullable().optional(),
  countries: z.array(z.string().min(1).max(100)).max(50).optional(),
  cities:    z.array(z.string().min(1).max(100)).max(50).optional(),
  religions: z.array(z.string().min(1).max(50)).max(20).optional(),
}).refine(
  (data) => {
    if (data.ageMin !== undefined && data.ageMax !== undefined &&
        data.ageMin !== null && data.ageMax !== null) {
      return data.ageMin <= data.ageMax;
    }
    return true;
  },
  { message: 'ageMin must be <= ageMax', path: ['ageMin'] },
);

export type SetPartnerPreferenceBody = z.infer<typeof setPartnerPreferenceSchema>;
