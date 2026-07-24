import { api } from '@/lib/axios';
import type { ApiResponse } from '@/types';

export interface AdminEvent {
  id: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string | null;
  location: string | null;
  tags: string[];
  isArchived: boolean;
  rsvpCount: number;
  createdAt: string;
}

export async function fetchAdminEvents(params: { upcoming?: boolean; page?: number; limit?: number } = {}): Promise<{ events: AdminEvent[]; total: number }> {
  const res = await api.get<ApiResponse<{ events: AdminEvent[]; total: number }>>('/admin/events', { params });
  return res.data.data;
}

export async function createEvent(body: {
  title: string;
  description?: string;
  startAt: string;
  endAt?: string;
  location?: string;
  tags?: string[];
}): Promise<AdminEvent> {
  const res = await api.post<ApiResponse<AdminEvent>>('/admin/events', body);
  return res.data.data;
}

export async function updateEvent(id: string, body: Partial<{
  title: string; description: string; startAt: string; endAt: string; location: string; tags: string[];
}>): Promise<AdminEvent> {
  const res = await api.patch<ApiResponse<AdminEvent>>(`/admin/events/${id}`, body);
  return res.data.data;
}

export async function archiveEvent(id: string): Promise<void> {
  await api.post(`/admin/events/${id}/archive`);
}
