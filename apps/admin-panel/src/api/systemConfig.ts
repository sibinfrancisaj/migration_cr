import { api } from '@/lib/axios';
import type { ApiResponse } from '@/types';

export interface SystemConfigEntry {
  key: string;
  value: string;
  description: string | null;
  isProtected: boolean;
  updatedAt: string;
}

export async function fetchSystemConfig(): Promise<SystemConfigEntry[]> {
  const res = await api.get<ApiResponse<SystemConfigEntry[]>>('/admin/system-config');
  return res.data.data;
}

export async function upsertSystemConfig(key: string, value: string): Promise<SystemConfigEntry> {
  const res = await api.put<ApiResponse<SystemConfigEntry>>(`/admin/system-config/${key}`, { value });
  return res.data.data;
}

export async function createSystemConfig(body: { key: string; value: string; description?: string }): Promise<SystemConfigEntry> {
  const res = await api.post<ApiResponse<SystemConfigEntry>>('/admin/system-config', body);
  return res.data.data;
}

export async function deleteSystemConfig(key: string): Promise<void> {
  await api.delete(`/admin/system-config/${key}`);
}
