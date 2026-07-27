import { api } from '@/lib/axios';
import type { ApiResponse, SeederStatus } from '@/types';

export async function fetchSeederStatus(): Promise<SeederStatus> {
  const res = await api.get<ApiResponse<{ seededCounts: SeederStatus['seededCounts'] } & Omit<SeederStatus, 'seededCounts'>>>('/admin/seeder/status');
  return res.data.data as unknown as SeederStatus;
}

export async function flushSeeder(): Promise<void> {
  await api.post('/admin/seeder/flush');
}

export async function triggerDrip(): Promise<void> {
  await api.post('/admin/seeder/trigger-drip');
}

export async function triggerActivity(): Promise<void> {
  await api.post('/admin/seeder/trigger-activity');
}

export async function pauseDrip(): Promise<void> {
  await api.post('/admin/seeder/pause-drip');
}

export async function resumeDrip(): Promise<void> {
  await api.post('/admin/seeder/resume-drip');
}

export async function pauseActivity(): Promise<void> {
  await api.post('/admin/seeder/pause-activity');
}

export async function resumeActivity(): Promise<void> {
  await api.post('/admin/seeder/resume-activity');
}

export async function seedGroups(): Promise<void> {
  await api.post('/admin/seeder/seed-groups');
}
