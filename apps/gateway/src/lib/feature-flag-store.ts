import { prisma } from '@abroad-matrimony/db';
import type { FeatureFlagStore, FeatureFlagRecord } from '@abroad-matrimony/config';

/**
 * Prisma-backed implementation of `FeatureFlagStore`.
 *
 * Reads directly from the `feature_flags` table.
 * In production, this should be wrapped with a Redis cache (TTL from
 * CACHE_TTL.FEATURE_FLAG_SECONDS) to avoid hitting the DB on every request.
 * For Phase 4 MVP the uncached version is sufficient.
 *
 * @see libs/config/src/feature-flags.ts — FeatureFlagService (the consumer)
 */
export class PrismaFeatureFlagStore implements FeatureFlagStore {
  async get(key: string): Promise<FeatureFlagRecord | null> {
    const row = await prisma.featureFlag.findUnique({
      where: { key },
      select: {
        key:                 true,
        enabled:             true,
        rolloutPercentage:   true,
        allowedUserIds:      true,
        allowedEnvironments: true,
      },
    });

    if (!row) return null;

    return {
      key:                 row.key,
      enabled:             row.enabled,
      rolloutPercentage:   row.rolloutPercentage,
      allowedUserIds:      row.allowedUserIds,
      allowedEnvironments: row.allowedEnvironments,
    };
  }
}
