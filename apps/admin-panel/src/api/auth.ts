import { api } from '@/lib/axios';
import type { ApiResponse } from '@/types';

interface LoginResponse {
  token: string;
  admin: { id: string; email: string; name: string; role: string };
}

export async function adminLogin(email: string, password: string, totpCode?: string): Promise<LoginResponse> {
  const res = await api.post<ApiResponse<LoginResponse>>('/admin/auth/login', {
    email,
    password,
    ...(totpCode ? { totpCode } : {}),
  });
  return res.data.data;
}
