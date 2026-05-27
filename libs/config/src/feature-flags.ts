/**
 * Feature flag service — DB as source of truth, Redis as 5-min cache.
 * Flags are toggled in the admin panel. No 3rd party needed.
 */

export interface FeatureFlagContext {
  userId?: string;
  environment?: string;
}

export interface FeatureFlagRecord {
  key: string;
  enabled: boolean;
  rolloutPercentage: number;
  allowedUserIds: string[];
  allowedEnvironments: string[];
}

export interface FeatureFlagStore {
  get(key: string): Promise<FeatureFlagRecord | null>;
}

export class FeatureFlagService {
  constructor(
    private readonly store: FeatureFlagStore,
    private readonly defaultEnvironment = 'development',
  ) {}

  async isEnabled(key: string, ctx: FeatureFlagContext = {}): Promise<boolean> {
    const flag = await this.store.get(key);
    if (!flag) return false;
    if (!flag.enabled) return false;

    const env = ctx.environment ?? this.defaultEnvironment;
    if (flag.allowedEnvironments.length > 0 && !flag.allowedEnvironments.includes(env)) {
      return false;
    }

    if (ctx.userId && flag.allowedUserIds.includes(ctx.userId)) {
      return true;
    }

    if (flag.rolloutPercentage >= 100) return true;
    if (flag.rolloutPercentage <= 0) return false;

    const hash = this.hashUserId(ctx.userId ?? 'anonymous', key);
    return hash % 100 < flag.rolloutPercentage;
  }

  private hashUserId(userId: string, key: string): number {
    const str = `${userId}:${key}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }
}
