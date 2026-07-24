import { api } from '@/lib/axios';
import type { ApiResponse, DiamondAnalyticsDto } from '@/types';

export interface RefundResult {
  paymentId: string;
  refundedAt: string;
}

export async function issueRefund(body: { userId: string; paymentId: string; reason?: string }): Promise<RefundResult> {
  const res = await api.post<ApiResponse<RefundResult>>('/admin/payment/refund', body);
  return res.data.data;
}

export async function fetchDiamondAnalytics(): Promise<DiamondAnalyticsDto> {
  const res = await api.get<ApiResponse<DiamondAnalyticsDto>>('/admin/analytics/diamonds');
  return res.data.data;
}
