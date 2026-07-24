import { api } from '@/lib/axios';
import type { ApiResponse } from '@/types';

export interface FeatureFlag {
  key: string;
  description: string | null;
  enabled: boolean;
  rolloutPercentage: number;
  allowedUserIds: string[];
  allowedEnvironments: string[];
  updatedAt: string;
}

export async function fetchFeatureFlags(): Promise<FeatureFlag[]> {
  const res = await api.get<ApiResponse<FeatureFlag[]>>('/admin/feature-flags');
  return res.data.data;
}

export async function createFeatureFlag(body: {
  key: string;
  description?: string;
  enabled?: boolean;
  rolloutPercentage?: number;
}): Promise<FeatureFlag> {
  const res = await api.post<ApiResponse<FeatureFlag>>('/admin/feature-flags', body);
  return res.data.data;
}

export async function updateFeatureFlag(
  key: string,
  body: Partial<{ enabled: boolean; rolloutPercentage: number; allowedUserIds: string[]; allowedEnvironments: string[] }>,
): Promise<FeatureFlag> {
  const res = await api.patch<ApiResponse<FeatureFlag>>(`/admin/feature-flags/${key}`, body);
  return res.data.data;
}

export async function deleteFeatureFlag(key: string): Promise<void> {
  await api.delete(`/admin/feature-flags/${key}`);
}
