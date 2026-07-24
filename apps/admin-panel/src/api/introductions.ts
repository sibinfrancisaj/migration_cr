import { api } from '@/lib/axios';
import type { ApiResponse } from '@/types';

export interface AdminDrop {
  id: string;
  title: string;
  theme: string | null;
  status: string;
  memberCount: number;
  pairingCount: number;
  releaseAt: string | null;
  createdAt: string;
}

export async function fetchAdminDrops(params: { status?: string; page?: number; limit?: number } = {}): Promise<{ drops: AdminDrop[]; total: number }> {
  const res = await api.get<ApiResponse<{ drops: AdminDrop[]; total: number }>>('/admin/introductions', { params });
  return res.data.data;
}

export async function approveDrop(dropId: string): Promise<void> {
  await api.patch(`/admin/introductions/${dropId}/approve`);
}

export async function scheduleDrop(dropId: string, releaseAt: string): Promise<void> {
  await api.patch(`/admin/introductions/${dropId}/schedule`, { releaseAt });
}

export async function proposeNewDrop(body: { title: string; theme?: string; earlyAccessCost?: number; unlockCost?: number }): Promise<AdminDrop> {
  const res = await api.post<ApiResponse<AdminDrop>>('/admin/introductions/propose', body);
  return res.data.data;
}
