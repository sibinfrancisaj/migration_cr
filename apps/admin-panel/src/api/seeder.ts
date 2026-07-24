import { api } from '@/lib/axios';
import type { ApiResponse, SeederStatus } from '@/types';

export async function fetchSeederStatus(): Promise<SeederStatus> {
  const res = await api.get<ApiResponse<SeederStatus>>('/admin/seeder/status');
  return res.data.data;
}

export async function flushSeeder(): Promise<void> {
  await api.post('/admin/seeder/flush');
}
