import { api } from '@/lib/axios';
import type {
  ApiResponse, KpiDto, CohortBucket, GroupAnalyticsDto, DropAnalyticsDto,
  AiAnalyticsDto, DiamondAnalyticsDto, SeederStatus,
  MatchHealthDto, UserMatchesResponse, UserActivityDto,
} from '@/types';

export interface DateRange { from?: string; to?: string }

export async function fetchKpi(range?: DateRange): Promise<KpiDto> {
  const res = await api.get<ApiResponse<KpiDto>>('/admin/analytics/kpi', { params: range });
  return res.data.data;
}

export async function fetchCohort(range?: DateRange): Promise<CohortBucket[]> {
  const res = await api.get<ApiResponse<CohortBucket[]>>('/admin/analytics/cohort', { params: range });
  return res.data.data;
}

export async function fetchGroupAnalytics(range?: DateRange): Promise<GroupAnalyticsDto> {
  const res = await api.get<ApiResponse<GroupAnalyticsDto>>('/admin/analytics/groups', { params: range });
  return res.data.data;
}

export async function fetchDropAnalytics(range?: DateRange): Promise<DropAnalyticsDto> {
  const res = await api.get<ApiResponse<DropAnalyticsDto>>('/admin/analytics/drops', { params: range });
  return res.data.data;
}

export async function fetchAiAnalytics(range?: DateRange): Promise<AiAnalyticsDto> {
  const res = await api.get<ApiResponse<AiAnalyticsDto>>('/admin/analytics/ai', { params: range });
  return res.data.data;
}

export async function fetchDiamondAnalytics(range?: DateRange): Promise<DiamondAnalyticsDto> {
  const res = await api.get<ApiResponse<DiamondAnalyticsDto>>('/admin/analytics/diamonds', { params: range });
  return res.data.data;
}

export async function fetchSeederStatus(): Promise<SeederStatus> {
  const res = await api.get<ApiResponse<SeederStatus>>('/admin/seeder/status');
  return res.data.data;
}

export async function fetchMatchHealth(): Promise<MatchHealthDto> {
  const res = await api.get<ApiResponse<MatchHealthDto>>('/admin/analytics/match-health');
  return res.data.data;
}

export async function fetchUserMatches(userId: string, limit = 20): Promise<UserMatchesResponse> {
  const res = await api.get<ApiResponse<UserMatchesResponse>>(`/admin/users/${userId}/matches`, { params: { limit } });
  return res.data.data;
}

export async function fetchUserActivity(userId: string): Promise<UserActivityDto> {
  const res = await api.get<ApiResponse<UserActivityDto>>(`/admin/users/${userId}/activity`);
  return res.data.data;
}
