import { getPartnerPreferences, setPartnerPreferences } from '../partner-preferences.service.js';

jest.mock('@abroad-matrimony/db', () => ({
  prisma: {
    partnerPreference: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

jest.mock('@abroad-matrimony/logger', () => ({
  createChildLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));

const { prisma } = jest.requireMock('@abroad-matrimony/db') as {
  prisma: {
    partnerPreference: {
      findUnique: jest.Mock;
      upsert: jest.Mock;
    };
  };
};

describe('getPartnerPreferences', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns empty defaults when no row exists', async () => {
    prisma.partnerPreference.findUnique.mockResolvedValue(null);
    const prefs = await getPartnerPreferences('u1');
    expect(prefs).toEqual({ ageMin: null, ageMax: null, countries: [], cities: [], religions: [] });
  });

  it('returns stored values when row exists', async () => {
    prisma.partnerPreference.findUnique.mockResolvedValue({
      ageMin: 25, ageMax: 35, countries: ['GB'], cities: ['London'], religions: ['Hindu'],
    });
    const prefs = await getPartnerPreferences('u1');
    expect(prefs.ageMin).toBe(25);
    expect(prefs.countries).toEqual(['GB']);
  });
});

describe('setPartnerPreferences', () => {
  beforeEach(() => jest.clearAllMocks());

  it('upserts with supplied values', async () => {
    prisma.partnerPreference.findUnique.mockResolvedValue(null);
    const stored = { ageMin: 25, ageMax: 35, countries: ['GB'], cities: [], religions: [] };
    prisma.partnerPreference.upsert.mockResolvedValue(stored);
    const result = await setPartnerPreferences('u1', { ageMin: 25, ageMax: 35, countries: ['GB'] });
    expect(prisma.partnerPreference.upsert).toHaveBeenCalled();
    expect(result.ageMin).toBe(25);
  });

  it('does a partial update — only supplied fields in update block', async () => {
    prisma.partnerPreference.findUnique.mockResolvedValue({
      ageMin: 25, ageMax: 35, countries: [], cities: [], religions: [],
    });
    prisma.partnerPreference.upsert.mockResolvedValue({
      ageMin: 25, ageMax: 40, countries: [], cities: [], religions: [],
    });
    await setPartnerPreferences('u1', { ageMax: 40 });
    const callArgs = prisma.partnerPreference.upsert.mock.calls[0]?.[0] as { update: Record<string, unknown> };
    expect(callArgs.update).toEqual({ ageMax: 40 });
  });

  it('allows clearing fields with null', async () => {
    prisma.partnerPreference.findUnique.mockResolvedValue({
      ageMin: 25, ageMax: 35, countries: [], cities: [], religions: [],
    });
    prisma.partnerPreference.upsert.mockResolvedValue({
      ageMin: null, ageMax: null, countries: [], cities: [], religions: [],
    });
    const result = await setPartnerPreferences('u1', { ageMin: null, ageMax: null });
    expect(result.ageMin).toBeNull();
  });
});
