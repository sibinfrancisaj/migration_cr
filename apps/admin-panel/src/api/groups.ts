import { api } from '@/lib/axios';
import type { ApiResponse } from '@/types';

export interface AdminGroup {
  id: string;
  name: string;
  type: string;
  scope: string;
  memberCount: number;
  isArchived: boolean;
  createdAt: string;
}

export interface GroupProposal {
  id: string;
  proposedName: string;
  description: string | null;
  proposerId: string;
  status: string;
  createdAt: string;
}

export async function fetchAdminGroups(params: { type?: string; page?: number; limit?: number } = {}): Promise<{ groups: AdminGroup[]; total: number }> {
  const res = await api.get<ApiResponse<{ groups: AdminGroup[]; total: number }>>('/admin/groups', { params });
  return res.data.data;
}

export async function createAdminGroup(body: { name: string; type: string; scope?: string; description?: string }): Promise<AdminGroup> {
  const res = await api.post<ApiResponse<AdminGroup>>('/admin/groups', body);
  return res.data.data;
}

export async function archiveAdminGroup(id: string): Promise<void> {
  await api.post(`/admin/groups/${id}/archive`);
}

export async function fetchGroupProposals(status?: string): Promise<GroupProposal[]> {
  const res = await api.get<ApiResponse<GroupProposal[]>>('/admin/groups/proposals', { params: status ? { status } : {} });
  return res.data.data;
}

export async function approveGroupProposal(proposalId: string): Promise<void> {
  await api.post(`/admin/groups/proposals/${proposalId}/approve`);
}

export async function rejectGroupProposal(proposalId: string, reason?: string): Promise<void> {
  await api.post(`/admin/groups/proposals/${proposalId}/reject`, { reason });
}
