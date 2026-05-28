import type { Request, Response, NextFunction } from 'express';
import { createChildLogger } from '@abroad-matrimony/logger';
import { getEnv, FeatureFlagService } from '@abroad-matrimony/config';
import { getDiscoveryFeed, ALGORITHM_VERSION } from '@abroad-matrimony/matching';
import type { ApiResponse, DiscoveryItemDto } from '@abroad-matrimony/shared';
import { FEATURE_FLAGS } from '@abroad-matrimony/shared';
import { PrismaFeatureFlagStore } from '../../lib/feature-flag-store.js';
import type { DiscoverQuery } from '../../schemas/discover/discover.schema.js';

// ── Feature flag service (lazy singleton) ─────────────────────────────────────
// Initialised on the first request rather than at import time so Jest mocks are
// fully in place before the constructor runs.

let _ffService: FeatureFlagService | null = null;

function getFeatureFlagService(): FeatureFlagService {
  if (!_ffService) {
    _ffService = new FeatureFlagService(
      new PrismaFeatureFlagStore(),
      getEnv().NODE_ENV,
    );
  }
  return _ffService;
}

// ── Controller ─────────────────────────────────────────────────────────────────

export const discoverController = {
  /**
   * GET /api/v1/discover?cursor=&limit=20
   *
   * Returns a paginated list of compatible profiles for the requesting user,
   * sorted by compatibility score (highest first).
   *
   * MATCH-005: If the `matching_algorithm_v2` feature flag is enabled for the
   * requesting user, scores computed with algorithmV='v2' are used instead of
   * the default 'v1'. Since v2 is not yet trained, the gate is infrastructure-only.
   */
  async getFeed(req: Request, res: Response, next: NextFunction): Promise<void> {
    const log = createChildLogger({ module: 'gateway:discover', requestId: req.requestId });
    try {
      const userId          = req.user!.id;
      const { cursor, limit } = req.query as unknown as DiscoverQuery;

      // MATCH-005 — feature-flag gate for algorithm v2
      const ffService = getFeatureFlagService();
      const useV2 = await ffService.isEnabled(
        FEATURE_FLAGS.MATCHING_ALGORITHM_V2,
        { userId, environment: getEnv().NODE_ENV },
      );
      const algorithmVersion = useV2 ? 'v2' : ALGORITHM_VERSION;

      log.info('Discovery feed requested', { userId, limit, hasCursor: !!cursor, algorithmVersion });

      const feed = await getDiscoveryFeed(userId, { cursor, limit, algorithmVersion });

      const body: ApiResponse<DiscoveryItemDto[]> = {
        success:   true,
        data:      feed.items,
        meta: {
          cursor:  feed.nextCursor ?? undefined,
          hasMore: feed.hasMore,
        },
        requestId: req.requestId,
      };
      res.status(200).json(body);
    } catch (err) {
      next(err);
    }
  },
};
