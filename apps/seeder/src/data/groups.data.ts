/**
 * SEED-GRP — System group definitions for GRP-R-007.
 *
 * These groups are created once by seedSystemGroups() and are NOT flushed
 * with seeded user data (isSeeded: false on the Group record).
 *
 * Coverage:
 *   - REGIONAL  : 5 country-level groups (UK, Germany, Australia, Canada, India)
 *   - CULTURAL  : 6 diaspora community groups
 *   - PROFESSIONAL: 5 sector umbrella groups
 *   - INTEREST  : 5 starter interest groups
 */

export type GroupSeedDef = {
  name: string;
  description: string;
  type: 'REGIONAL' | 'CULTURAL' | 'PROFESSIONAL' | 'INTEREST';
  scope: 'COUNTRY' | 'GLOBAL';
  region: string;
  country?: string;
  culturalTag?: string;
  professionTag?: string;
  capacity: number;
  maxMembers: number;
};

// ── REGIONAL — one per country, auto-joined on registration ──────────────────

export const REGIONAL_GROUPS: GroupSeedDef[] = [
  {
    name: 'Indians in the UK',
    description: 'The home for Indian professionals, students, and families living across the United Kingdom.',
    type: 'REGIONAL',
    scope: 'COUNTRY',
    region: 'Europe',
    country: 'United Kingdom',
    capacity: 10000,
    maxMembers: 10000,
  },
  {
    name: 'Indians in Germany',
    description: 'Connecting the Indian diaspora living and working across Germany.',
    type: 'REGIONAL',
    scope: 'COUNTRY',
    region: 'Europe',
    country: 'Germany',
    capacity: 10000,
    maxMembers: 10000,
  },
  {
    name: 'Indians in Australia',
    description: 'For Indians living across Australia — from Sydney to Perth.',
    type: 'REGIONAL',
    scope: 'COUNTRY',
    region: 'Oceania',
    country: 'Australia',
    capacity: 10000,
    maxMembers: 10000,
  },
  {
    name: 'Indians in Canada',
    description: 'The community hub for Indians settled across Canada.',
    type: 'REGIONAL',
    scope: 'COUNTRY',
    region: 'North America',
    country: 'Canada',
    capacity: 10000,
    maxMembers: 10000,
  },
  {
    name: 'Indians in India',
    description: 'For Indian singles based in India considering or open to matches abroad.',
    type: 'REGIONAL',
    scope: 'COUNTRY',
    region: 'South Asia',
    country: 'India',
    capacity: 10000,
    maxMembers: 10000,
  },
];

// ── CULTURAL — diaspora community groups ─────────────────────────────────────

export const CULTURAL_GROUPS: GroupSeedDef[] = [
  {
    name: 'South Indian Diaspora',
    description: 'Connecting Tamils, Malayalis, Kannadigas, and Telugus living abroad.',
    type: 'CULTURAL',
    scope: 'GLOBAL',
    region: 'Global',
    culturalTag: 'South Indian',
    capacity: 5000,
    maxMembers: 5000,
  },
  {
    name: 'Punjabi Community Abroad',
    description: 'For Punjabis (Hindu, Sikh, and others) living outside India.',
    type: 'CULTURAL',
    scope: 'GLOBAL',
    region: 'Global',
    culturalTag: 'Punjabi',
    capacity: 5000,
    maxMembers: 5000,
  },
  {
    name: 'Gujarati Community Worldwide',
    description: 'Gujaratis across the globe — from Leicester to Toronto.',
    type: 'CULTURAL',
    scope: 'GLOBAL',
    region: 'Global',
    culturalTag: 'Gujarati',
    capacity: 5000,
    maxMembers: 5000,
  },
  {
    name: 'Bengali Diaspora',
    description: 'For Bengalis (West Bengal and Bangladesh origin) living abroad.',
    type: 'CULTURAL',
    scope: 'GLOBAL',
    region: 'Global',
    culturalTag: 'Bengali',
    capacity: 5000,
    maxMembers: 5000,
  },
  {
    name: 'Malayali Global Network',
    description: 'Kerala connections worldwide — Malayalis across every continent.',
    type: 'CULTURAL',
    scope: 'GLOBAL',
    region: 'Global',
    culturalTag: 'Malayali',
    capacity: 5000,
    maxMembers: 5000,
  },
  {
    name: 'Marathi Abroad',
    description: 'For Maharashtrians and Marathis settled outside India.',
    type: 'CULTURAL',
    scope: 'GLOBAL',
    region: 'Global',
    culturalTag: 'Marathi',
    capacity: 5000,
    maxMembers: 5000,
  },
];

// ── PROFESSIONAL — sector umbrella groups ────────────────────────────────────

export const PROFESSIONAL_GROUPS: GroupSeedDef[] = [
  {
    name: 'Tech & Engineering Diaspora',
    description: 'Software engineers, architects, data scientists, and hardware professionals across the diaspora.',
    type: 'PROFESSIONAL',
    scope: 'GLOBAL',
    region: 'Global',
    professionTag: 'Engineering & Technology',
    capacity: 5000,
    maxMembers: 5000,
  },
  {
    name: 'Healthcare Professionals Abroad',
    description: 'Indian doctors, nurses, pharmacists, and allied health professionals in the diaspora.',
    type: 'PROFESSIONAL',
    scope: 'GLOBAL',
    region: 'Global',
    professionTag: 'Medical & Healthcare',
    capacity: 5000,
    maxMembers: 5000,
  },
  {
    name: 'Finance & Business Network',
    description: 'Bankers, consultants, accountants, and entrepreneurs in the Indian diaspora.',
    type: 'PROFESSIONAL',
    scope: 'GLOBAL',
    region: 'Global',
    professionTag: 'Finance & Business',
    capacity: 5000,
    maxMembers: 5000,
  },
  {
    name: 'Academia & Research Community',
    description: 'Professors, researchers, PhD students, and educators across the diaspora.',
    type: 'PROFESSIONAL',
    scope: 'GLOBAL',
    region: 'Global',
    professionTag: 'Education & Research',
    capacity: 5000,
    maxMembers: 5000,
  },
  {
    name: 'Legal & Public Sector Professionals',
    description: 'Lawyers, civil servants, policy professionals, and those in public sector roles abroad.',
    type: 'PROFESSIONAL',
    scope: 'GLOBAL',
    region: 'Global',
    professionTag: 'Legal & Public Sector',
    capacity: 5000,
    maxMembers: 5000,
  },
];

// ── INTEREST — starter interest groups ───────────────────────────────────────

export const INTEREST_GROUPS: GroupSeedDef[] = [
  {
    name: 'Vegetarian & Vegan Diaspora',
    description: 'Sharing plant-based recipes, restaurant tips, and lifestyle ideas for Indians abroad.',
    type: 'INTEREST',
    scope: 'GLOBAL',
    region: 'Global',
    capacity: 2000,
    maxMembers: 2000,
  },
  {
    name: 'Hiking & Outdoors',
    description: 'Trail walks, national parks, weekend hikes — for the adventurous Indian diaspora.',
    type: 'INTEREST',
    scope: 'GLOBAL',
    region: 'Global',
    capacity: 2000,
    maxMembers: 2000,
  },
  {
    name: 'Classical Indian Music & Dance',
    description: 'Carnatic, Hindustani, Bharatanatyam, Kathak — celebrating our classical arts abroad.',
    type: 'INTEREST',
    scope: 'GLOBAL',
    region: 'Global',
    capacity: 2000,
    maxMembers: 2000,
  },
  {
    name: 'Cricket Fans',
    description: 'Match discussions, predictions, fantasy cricket, and live viewing parties.',
    type: 'INTEREST',
    scope: 'GLOBAL',
    region: 'Global',
    capacity: 2000,
    maxMembers: 2000,
  },
  {
    name: 'Yoga & Mindfulness',
    description: 'Daily practice tips, guided sessions, and mindfulness discussions for the diaspora.',
    type: 'INTEREST',
    scope: 'GLOBAL',
    region: 'Global',
    capacity: 2000,
    maxMembers: 2000,
  },
];

// ── Aggregated export ──────────────────────────────────────────────────────────

export const ALL_SYSTEM_GROUPS: GroupSeedDef[] = [
  ...REGIONAL_GROUPS,
  ...CULTURAL_GROUPS,
  ...PROFESSIONAL_GROUPS,
  ...INTEREST_GROUPS,
];
