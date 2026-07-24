import { api } from '@/lib/axios';
import type { ApiResponse } from '@/types';

export interface AdminPrompt {
  id: string;
  text: string;
  isActive: boolean;
  responseCount: number;
  createdAt: string;
}

export async function fetchAdminPrompts(params: { page?: number; limit?: number } = {}): Promise<{ prompts: AdminPrompt[]; total: number }> {
  const res = await api.get<ApiResponse<{ prompts: AdminPrompt[]; total: number }>>('/admin/prompts', { params });
  return res.data.data;
}

export async function createPrompt(body: { text: string }): Promise<AdminPrompt> {
  const res = await api.post<ApiResponse<AdminPrompt>>('/admin/prompts', body);
  return res.data.data;
}

export async function updatePrompt(id: string, body: Partial<{ text: string; isActive: boolean }>): Promise<AdminPrompt> {
  const res = await api.patch<ApiResponse<AdminPrompt>>(`/admin/prompts/${id}`, body);
  return res.data.data;
}
