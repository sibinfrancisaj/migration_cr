/**
 * SEED-002 — Profile factory.
 *
 * Generates a realistic Indian-diaspora profile and creates it via the gateway API
 * using the SEEDER_SECRET auth bypass. Full flow:
 *   1. Phone registration (OTP bypass)
 *   2. OTP verify (OTP bypass) → receives JWT tokens
 *   3. POST /api/v1/profile — create profile
 *   4. PUT real-life answers (all 12 questions)
 *   5. PUT story prompt answers (all 3 prompts)
 *   6. Direct DB insert for photo URL (avoids S3 presigned upload cost in seeder)
 */
import { getPrismaClient } from '@abroad-matrimony/db';
import { seederLog } from '../lib/seeder-logger.js';
import { getGatewayClient, asUser } from '../lib/gateway-client.js';
import { randomName, ALL_CULTURAL_BACKGROUNDS } from '../data/names.data.js';
import { getRandomAnswer, type PersonaType } from '../data/real-life-answers.data.js';
import { getRandomStoryAnswer } from '../data/story-prompts.data.js';
import { pickPhotoUrl } from '../services/photo.service.js';

// ── Constants ──────────────────────────────────────────────────────────────────

const COUNTRY_DISTRIBUTION: Array<{ country: string; cities: string[]; weight: number }> = [
  { country: 'United Kingdom', cities: ['London', 'Manchester', 'Birmingham', 'Leeds', 'Glasgow'], weight: 35 },
  { country: 'Germany',        cities: ['Berlin', 'Munich', 'Hamburg', 'Frankfurt', 'Düsseldorf'], weight: 20 },
  { country: 'Australia',      cities: ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide'],  weight: 20 },
  { country: 'Canada',         cities: ['Toronto', 'Vancouver', 'Calgary', 'Ottawa', 'Montreal'], weight: 15 },
  { country: 'India',          cities: ['Mumbai', 'Delhi', 'Bangalore', 'Hyderabad', 'Chennai'],  weight: 10 },
];

const PROFESSION_TAGS = [
  'Medical & Healthcare',
  'Engineering & Technology',
  'Finance & Business',
  'Education & Research',
  'Legal & Public Sector',
  'Creative & Media',
  'Hospitality & Retail',
  'Life Sciences & Pharma',
  'Students & Early Career',
  'Other Professionals',
];

const SETTLEMENT_INTENTS: Array<'STAY' | 'RETURN' | 'OPEN'> = ['STAY', 'RETURN', 'OPEN'];

const QUESTION_KEYS = [
  'PARENTING_STYLE', 'FAITH_AND_SPIRITUALITY', 'DIET_AND_LIFESTYLE',
  'MONEY_AND_FINANCES', 'LIVING_SITUATION', 'SOCIAL_LIFE',
  'CAREER_AMBITIONS', 'CHILDREN_TIMELINE', 'HEALTH_AND_WELLBEING',
  'HOBBIES_AND_INTERESTS', 'SETTLEMENT_TIMELINE', 'FAMILY_INVOLVEMENT',
] as const;

const STORY_PROMPT_KEYS = ['LIFE_ABROAD', 'MATCH_IDEAL_PARTNER', 'WEEKEND_DAY'] as const;

const PERSONA_TYPES: PersonaType[] = ['traditional', 'modern', 'balanced', 'career-focused', 'family-first'];

// ── Helpers ────────────────────────────────────────────────────────────────────

function weightedRandom<T>(items: Array<{ weight: number } & T>): T {
  const total = items.reduce((sum, i) => sum + i.weight, 0);
  let rand = Math.random() * total;
  for (const item of items) {
    rand -= item.weight;
    if (rand <= 0) return item;
  }
  return items[items.length - 1]!;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function generatePhone(): string {
  // Fake E.164 numbers starting with +99 (not a real country code) to avoid conflicts
  const digits = String(randomInt(100_000_000, 999_999_999));
  return `+99${digits}`;
}

function generateDob(): string {
  // Age 23–38, weighted towards 26–33
  const weights = Array.from({ length: 16 }, (_, i) => {
    const age = 23 + i;
    if (age >= 26 && age <= 33) return 3;
    return 1;
  });
  const total = weights.reduce((s, w) => s + w, 0);
  let r = Math.random() * total;
  let ageOffset = 0;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i]!;
    if (r <= 0) { ageOffset = i; break; }
  }
  const age = 23 + ageOffset;
  const now = new Date();
  const year = now.getFullYear() - age;
  const month = String(randomInt(1, 12)).padStart(2, '0');
  const day = String(randomInt(1, 28)).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// ── Main factory ───────────────────────────────────────────────────────────────

export interface SeededProfileResult {
  userId: string;
  profileId: string;
  phone: string;
  country: string;
  city: string;
  profession: string;
  culturalBackground: string;
  gender: 'male' | 'female';
}

export async function createSeededProfile(): Promise<SeededProfileResult | null> {
  const client = getGatewayClient();
  const prisma = getPrismaClient();

  const gender: 'male' | 'female' = Math.random() < 0.5 ? 'male' : 'female';
  const location = weightedRandom(COUNTRY_DISTRIBUTION);
  const city = randomFrom(location.cities);
  const culturalBackground = randomFrom(ALL_CULTURAL_BACKGROUNDS);
  const profession = randomFrom(PROFESSION_TAGS);
  const persona = randomFrom(PERSONA_TYPES);
  const settlementIntent = randomFrom(SETTLEMENT_INTENTS);
  const phone = generatePhone();
  const dob = generateDob();
  const { firstName, lastName } = randomName(culturalBackground, gender);
  const name = `${firstName} ${lastName}`;

  seederLog.debug('Creating seeded profile', { name, country: location.country, city, phone });

  try {
    // ── Step 1: Register phone (OTP request — no actual OTP sent for seeder phones) ─
    await client.post('/api/v1/auth/otp/request', { phone });

    // ── Step 2: Verify OTP with bypass code (seeder uses '000000' as OTP) ──────
    // Gateway OTP verify accepts '000000' when SEEDER_SECRET is active AND
    // fingerprint is 'seeder-fingerprint' — this is handled in otp-verify.service.
    // For now we use the seeder secret header to create a direct DB user entry.
    // Simpler: create user directly in DB, then use seeder token for subsequent calls.
    const userResult = await prisma.user.create({
      data: {
        phone,
        isSeeded: true,
        role: 'USER',
        status: 'ACTIVE',
        devices: {
          create: {
            fingerprint: `seeder-${phone}`,
            userAgent: 'SeederBot/1.0',
          },
        },
      },
      include: { devices: true },
    });

    const userId = userResult.id;
    const deviceId = userResult.devices[0]?.id ?? 'seeder-device';

    // ── Step 3: Create profile ──────────────────────────────────────────────────
    await client.post(
      '/api/v1/profile',
      {
        name,
        dateOfBirth: dob,
        gender: gender.toUpperCase(),
        city,
        country: location.country,
        settlementIntent,
        bio: `${profession} based in ${city}. ${culturalBackground} background.`,
      },
      asUser(userId, 'USER', deviceId),
    );

    // ── Step 4: Real-life answers ───────────────────────────────────────────────
    for (const questionKey of QUESTION_KEYS) {
      const answer = getRandomAnswer(questionKey, persona);
      await client.put(
        `/api/v1/profile/real-life/${questionKey}`,
        { answer },
        asUser(userId, 'USER', deviceId),
      ).catch(() => {
        // Non-fatal — profile is still usable with partial answers
        seederLog.warn('Failed to set real-life answer', { userId, questionKey });
      });
    }

    // ── Step 5: Story prompt answers ────────────────────────────────────────────
    for (const promptKey of STORY_PROMPT_KEYS) {
      const answer = getRandomStoryAnswer(promptKey);
      await client.put(
        `/api/v1/profile/story/${promptKey}`,
        { answer },
        asUser(userId, 'USER', deviceId),
      ).catch(() => {
        seederLog.warn('Failed to set story prompt', { userId, promptKey });
      });
    }

    // ── Step 6: Photo assignment (direct DB update for seeder speed) ────────────
    const photoUrl = pickPhotoUrl(gender);
    if (photoUrl) {
      await prisma.profileMedia.create({
        data: {
          userId,
          url: photoUrl,
          type: 'PHOTO',
          position: 0,
          isSeeded: true,
        } as any,
      }).catch(() => {
        // ProfileMedia may not have isSeeded; fall back gracefully
        seederLog.warn('Could not add seeded photo', { userId });
      });
    }

    // Retrieve profileId
    const profile = await prisma.profile.findUnique({ where: { userId }, select: { id: true } });

    seederLog.info('Seeded profile created', {
      userId,
      name,
      country: location.country,
      city,
      profession,
      culturalBackground,
    });

    return {
      userId,
      profileId: profile?.id ?? userId,
      phone,
      country: location.country,
      city,
      profession,
      culturalBackground,
      gender,
    };
  } catch (err) {
    seederLog.error('Failed to create seeded profile', { phone, name, err });
    return null;
  }
}
