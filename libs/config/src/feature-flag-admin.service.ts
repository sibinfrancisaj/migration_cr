/**
 * ADMIN-003 — Feature flag administration service.
 * CRUD on feature flags + Redis cache invalidation.
 */
import { prisma } from '@abroad-matrimony/db';
import { getCache } from '@abroad-matrimony/cache';
import { createChildLogger } from '@abroad-matrimony/logger';

const log = createChildLogger({ module: 'config:feature-flag-admin' });
const FLAG_CACHE_PREFIX = 'feature_flag:';

export class FeatureFlagNotFoundError extends Error {
  constructor() { super('FEATURE_FLAG_NOT_FOUND'); this.name = 'FeatureFlagNotFoundError'; }
}
export class FeatureFlagAlreadyExistsError extends Error {
  constructor() { super('FEATURE_FLAG_ALREADY_EXISTS'); this.name = 'FeatureFlagAlreadyExistsError'; }
}

export interface FeatureFlagDto {
  id: string;
  key: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number;
  allowedUserIds: string[];
  allowedEnvironments: string[];
  createdAt: string;
  updatedAt: string;
}

function toDto(f: {
  id: string; key: string; description: string; enabled: boolean;
  rolloutPercentage: number; allowedUserIds: string[]; allowedEnvironments: string[];
  createdAt: Date; updatedAt: Date;
}): FeatureFlagDto {
  return {
    id: f.id,
    key: f.key,
    description: f.description,
    enabled: f.enabled,
    rolloutPercentage: f.rolloutPercentage,
    allowedUserIds: f.allowedUserIds,
    allowedEnvironments: f.allowedEnvironments,
    createdAt: f.createdAt.toISOString(),
    updatedAt: f.updatedAt.toISOString(),
  };
}

async function invalidateCache(key: string): Promise<void> {
  try {
    const cache = getCache();
    await cache.del(`${FLAG_CACHE_PREFIX}${key}`);
  } catch (err) {
    log.warn('Failed to invalidate feature flag cache', { key, err });
  }
}

// ─── listFeatureFlags ────────────────────────────────────────────────────────

export async function listFeatureFlags(): Promise<FeatureFlagDto[]> {
  const flags = await prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
  return flags.map(toDto);
}

// ─── getFeatureFlag ──────────────────────────────────────────────────────────

export async function getFeatureFlag(flagKey: string): Promise<FeatureFlagDto> {
  const flag = await prisma.featureFlag.findUnique({ where: { key: flagKey } });
  if (!flag) throw new FeatureFlagNotFoundError();
  return toDto(flag);
}

// ─── updateFeatureFlag ───────────────────────────────────────────────────────

export interface UpdateFlagInput {
  enabled?: boolean;
  rolloutPercentage?: number;
  allowedUserIds?: string[];
  allowedEnvironments?: string[];
  description?: string;
}

export async function updateFeatureFlag(
  flagKey: string,
  input: UpdateFlagInput,
): Promise<FeatureFlagDto> {
  const existing = await prisma.featureFlag.findUnique({ where: { key: flagKey } });
  if (!existing) throw new FeatureFlagNotFoundError();

  const updated = await prisma.featureFlag.update({
    where: { key: flagKey },
    data: {
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      ...(input.rolloutPercentage !== undefined ? { rolloutPercentage: input.rolloutPercentage } : {}),
      ...(input.allowedUserIds !== undefined ? { allowedUserIds: input.allowedUserIds } : {}),
      ...(input.allowedEnvironments !== undefined ? { allowedEnvironments: input.allowedEnvironments } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
    },
  });

  await invalidateCache(flagKey);
  log.info('Feature flag updated', { flagKey, changes: input });
  return toDto(updated);
}

// ─── createFeatureFlag ───────────────────────────────────────────────────────

export interface CreateFlagInput {
  key: string;
  description: string;
  enabled?: boolean;
  rolloutPercentage?: number;
  allowedUserIds?: string[];
  allowedEnvironments?: string[];
}

export async function createFeatureFlag(input: CreateFlagInput): Promise<FeatureFlagDto> {
  const existing = await prisma.featureFlag.findUnique({ where: { key: input.key } });
  if (existing) throw new FeatureFlagAlreadyExistsError();

  const flag = await prisma.featureFlag.create({
    data: {
      key: input.key,
      description: input.description,
      enabled: input.enabled ?? false,
      rolloutPercentage: input.rolloutPercentage ?? 0,
      allowedUserIds: input.allowedUserIds ?? [],
      allowedEnvironments: input.allowedEnvironments ?? [],
    },
  });

  log.info('Feature flag created', { key: input.key });
  return toDto(flag);
}

// ─── deleteFeatureFlag ───────────────────────────────────────────────────────

export async function deleteFeatureFlag(flagKey: string): Promise<void> {
  const existing = await prisma.featureFlag.findUnique({ where: { key: flagKey } });
  if (!existing) throw new FeatureFlagNotFoundError();

  await prisma.featureFlag.delete({ where: { key: flagKey } });
  await invalidateCache(flagKey);
  log.info('Feature flag deleted', { key: flagKey });
}
