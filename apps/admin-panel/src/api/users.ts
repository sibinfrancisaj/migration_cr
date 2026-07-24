import { api } from '@/lib/axios';
import type { ApiResponse, UserAdminSummary, UserAdminDetail } from '@/types';

export interface UserListParams {
  search?: string;
  status?: string;
  limit?: number;
  cursor?: string;
}

export interface UserListResult {
  users: UserAdminSummary[];
  hasMore: boolean;
  nextCursor: string | null;
}

export async function fetchUsers(params: UserListParams = {}): Promise<UserListResult> {
  const res = await api.get<ApiResponse<UserListResult>>('/admin/users', { params });
  return res.data.data;
}

export async function fetchUserDetail(userId: string): Promise<UserAdminDetail> {
  const res = await api.get<ApiResponse<UserAdminDetail>>(`/admin/users/${userId}`);
  return res.data.data;
}

export async function suspendUser(userId: string, reason: string): Promise<void> {
  await api.post(`/admin/users/${userId}/suspend`, { reason });
}

export async function unsuspendUser(userId: string): Promise<void> {
  await api.post(`/admin/users/${userId}/unsuspend`);
}

export async function banUser(userId: string, reason: string): Promise<void> {
  await api.post(`/admin/users/${userId}/ban`, { reason });
}

export async function wipeSeededUser(userId: string): Promise<void> {
  await api.delete(`/admin/users/${userId}/seeded-data`);
}
