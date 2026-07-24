import { api } from '@/lib/axios';
import type { ApiResponse, FlagItem, FlagListResult } from '@/types';

export async function fetchFlags(params: {
  status?: string;
  cursor?: string;
  limit?: number;
} = {}): Promise<FlagListResult> {
  const res = await api.get<ApiResponse<FlagListResult>>('/admin/flags', { params });
  return res.data.data;
}

export async function resolveFlag(
  flagId: string,
  payload: { status: 'RESOLVED' | 'DISMISSED'; actionTaken?: string; resolution?: string },
): Promise<FlagItem> {
  const res = await api.put<ApiResponse<FlagItem>>(`/admin/flags/${flagId}`, payload);
  return res.data.data;
}
