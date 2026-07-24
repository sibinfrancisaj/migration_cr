import { api } from '@/lib/axios';
import type { ApiResponse, VerificationAdminDto, VerificationListResult } from '@/types';

export async function fetchVerifications(params: {
  status?: string;
  cursor?: string;
  limit?: number;
} = {}): Promise<VerificationListResult> {
  const res = await api.get<ApiResponse<VerificationListResult>>('/admin/verification', { params });
  return res.data.data;
}

export async function fetchVerificationDetail(requestId: string): Promise<VerificationAdminDto> {
  const res = await api.get<ApiResponse<VerificationAdminDto>>(`/admin/verification/${requestId}`);
  return res.data.data;
}

export async function approveVerification(requestId: string): Promise<void> {
  await api.post(`/admin/verification/${requestId}/approve`);
}

export async function rejectVerification(requestId: string, reason: string): Promise<void> {
  await api.post(`/admin/verification/${requestId}/reject`, { reason });
}
