import { api } from '@/lib/axios';
import type { ApiResponse, AiAnalyticsDto } from '@/types';

export interface EmbeddingStatus {
  total: number;
  stale: number;
  pending: number;
  coverageRate: string;
  lastComputedAt: string | null;
}

export interface EmbeddingItem {
  userId: string;
  profileName: string | null;
  isStale: boolean;
  lastComputedAt: string | null;
}

export async function fetchAiEmbeddingStatus(): Promise<EmbeddingStatus> {
  const res = await api.get<ApiResponse<EmbeddingStatus>>('/admin/ai/embeddings/status');
  return res.data.data;
}

export async function fetchEmbeddings(params: { status?: string; limit?: number } = {}): Promise<EmbeddingItem[]> {
  const res = await api.get<ApiResponse<EmbeddingItem[]>>('/admin/ai/embeddings', { params });
  return res.data.data;
}

export async function recomputeEmbedding(userId: string): Promise<void> {
  await api.post(`/admin/ai/embeddings/${userId}/recompute`);
}

export async function recomputeAllStale(): Promise<void> {
  await api.post('/admin/ai/embeddings/recompute-all');
}

export async function proposeAiDrops(region: string): Promise<void> {
  await api.post('/admin/ai/drops/propose', { region });
}

export async function generatePreConnections(eventId: string): Promise<void> {
  await api.post(`/admin/ai/events/${eventId}/pre-connections`);
}
