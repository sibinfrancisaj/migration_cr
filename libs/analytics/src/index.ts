/**
 * @abroad-matrimony/analytics — KPI dashboard and extended analytics.
 * ADMIN-007: Core KPI metrics (users, profiles, connections, memberships, diamonds, matching).
 * ADMIN-017: Extended analytics (groups, drops, AI pipeline, diamond breakdown).
 */

// Core KPI dashboard (ADMIN-007)
export { getKpiDashboard, getCohortRetention } from './kpi.service.js';
export type { KpiParams, KpiDto, CohortParams, CohortBucket } from './kpi.service.js';

// Extended analytics (ADMIN-017)
export { getGroupAnalytics, getDropAnalytics, getAiAnalytics, getDiamondAnalytics } from './extended.service.js';
export type {
  PeriodParams,
  GroupAnalyticsDto,
  DropAnalyticsDto,
  AiAnalyticsDto,
  DiamondAnalyticsDto,
} from './extended.service.js';
