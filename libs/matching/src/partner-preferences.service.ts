/**
 * PROD-006 — Partner preference filters.
 *
 * Stores age range, country, city, and religion preferences per user.
 * Applied in getDiscoveryFeed() as a pre-filter before score ranking.
 */
import { prisma } from '@abroad-matrimony/db';
import { createChildLogger } from '@abroad-matrimony/logger';

const log = createChildLogger({ module: 'matching:partner-preferences' });

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface PartnerPreferenceDto {
  ageMin: number | null;
  ageMax: number | null;
  countries: string[];
  cities: string[];
  religions: string[];
}

export interface SetPartnerPreferenceInput {
  ageMin?: number | null;
  ageMax?: number | null;
  countries?: string[];
  cities?: string[];
  religions?: string[];
}

// ── Service ───────────────────────────────────────────────────────────────────

const EMPTY_PREFS: PartnerPreferenceDto = {
  ageMin: null,
  ageMax: null,
  countries: [],
  cities: [],
  religions: [],
};

export async function getPartnerPreferences(userId: string): Promise<PartnerPreferenceDto> {
  const row = await prisma.partnerPreference.findUnique({ where: { userId } });
  if (!row) return { ...EMPTY_PREFS };

  return {
    ageMin: row.ageMin,
    ageMax: row.ageMax,
    countries: row.countries,
    cities: row.cities,
    religions: row.religions,
  };
}

export async function setPartnerPreferences(
  userId: string,
  input: SetPartnerPreferenceInput,
): Promise<PartnerPreferenceDto> {
  const existing = await prisma.partnerPreference.findUnique({ where: { userId } });
  const base = existing ?? EMPTY_PREFS;

  const updated = await prisma.partnerPreference.upsert({
    where: { userId },
    create: {
      userId,
      ageMin:    input.ageMin    !== undefined ? input.ageMin    : base.ageMin,
      ageMax:    input.ageMax    !== undefined ? input.ageMax    : base.ageMax,
      countries: input.countries !== undefined ? input.countries : base.countries,
      cities:    input.cities    !== undefined ? input.cities    : base.cities,
      religions: input.religions !== undefined ? input.religions : base.religions,
    },
    update: {
      ...(input.ageMin    !== undefined ? { ageMin:    input.ageMin }    : {}),
      ...(input.ageMax    !== undefined ? { ageMax:    input.ageMax }    : {}),
      ...(input.countries !== undefined ? { countries: input.countries } : {}),
      ...(input.cities    !== undefined ? { cities:    input.cities }    : {}),
      ...(input.religions !== undefined ? { religions: input.religions } : {}),
    },
  });

  log.info('Partner preferences updated', { userId });

  return {
    ageMin: updated.ageMin,
    ageMax: updated.ageMax,
    countries: updated.countries,
    cities: updated.cities,
    religions: updated.religions,
  };
}
