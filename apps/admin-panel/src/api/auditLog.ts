import { api } from '@/lib/axios';
import type { ApiResponse } from '@/types';

export interface AuditLogEntry {
  id: string;
  adminId: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

export interface AuditLogResult {
  entries: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
}

export async function fetchAuditLog(params: {
  adminId?: string;
  action?: string;
  page?: number;
  limit?: number;
} = {}): Promise<AuditLogResult> {
  const res = await api.get<ApiResponse<AuditLogResult>>('/admin/audit-log', { params });
  return res.data.data;
}
