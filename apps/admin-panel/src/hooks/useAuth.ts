import { createContext, useContext } from 'react';
import type { AdminUser } from '@/types';

export interface AuthContextValue {
  admin: AdminUser | null;
  token: string | null;
  login: (token: string, admin: AdminUser) => void;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue>({
  admin: null,
  token: null,
  login: () => {},
  logout: () => {},
});

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
