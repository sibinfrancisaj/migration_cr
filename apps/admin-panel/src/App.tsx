import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

import { AuthContext } from '@/hooks/useAuth';
import { getToken, clearToken, decodePayload, isTokenExpired } from '@/lib/token';
import type { AdminUser } from '@/types';

import { AppShell } from '@/components/layout/AppShell';
import { LoginPage } from '@/pages/auth/LoginPage';
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { MatchIntelligencePage } from '@/pages/match-intelligence/MatchIntelligencePage';
import { UsersPage } from '@/pages/users/UsersPage';
import { ComingSoonPage } from '@/pages/ComingSoonPage';

const qc = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  const [token, setToken] = useState<string | null>(() => {
    const t = getToken();
    if (t && isTokenExpired(t)) { clearToken(); return null; }
    return t;
  });
  const [admin, setAdmin] = useState<AdminUser | null>(() => {
    const t = getToken();
    if (!t || isTokenExpired(t)) return null;
    const p = decodePayload<{ id?: string; email?: string; name?: string; role?: string }>(t);
    if (!p?.id) return null;
    return { id: p.id, email: p.email ?? '', name: p.name ?? 'Admin', role: (p.role as AdminUser['role']) ?? 'MODERATOR' };
  });

  useEffect(() => {
    if (token && isTokenExpired(token)) {
      clearToken(); setToken(null); setAdmin(null);
    }
  }, [token]);

  function login(newToken: string, newAdmin: AdminUser) {
    setToken(newToken);
    setAdmin(newAdmin);
  }
  function logout() {
    setToken(null);
    setAdmin(null);
  }

  return (
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={{ token, admin, login, logout }}>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<AppShell />}>
              <Route index element={<DashboardPage />} />
              <Route path="match-intelligence" element={<MatchIntelligencePage />} />
              <Route path="users"         element={<UsersPage />} />
              <Route path="verification"  element={<ComingSoonPage title="Verification Queue" icon="🪪" />} />
              <Route path="moderation"    element={<ComingSoonPage title="Content Moderation" icon="🚩" />} />
              <Route path="introductions" element={<ComingSoonPage title="Introduction Drops" icon="💌" />} />
              <Route path="groups"        element={<ComingSoonPage title="Groups" icon="🏘️" />} />
              <Route path="events"        element={<ComingSoonPage title="Events" icon="📅" />} />
              <Route path="prompts"       element={<ComingSoonPage title="Weekly Prompts" icon="💬" />} />
              <Route path="payments"      element={<ComingSoonPage title="Payments & Refunds" icon="💳" />} />
              <Route path="ai"            element={<ComingSoonPage title="AI Monitoring" icon="🤖" />} />
              <Route path="flags"         element={<ComingSoonPage title="Feature Flags" icon="🚦" />} />
              <Route path="config"        element={<ComingSoonPage title="System Config" icon="⚙️" />} />
              <Route path="audit"         element={<ComingSoonPage title="Audit Log" icon="📜" />} />
              <Route path="seeder"        element={<ComingSoonPage title="Seeder & Bot Control" icon="🌱" />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthContext.Provider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
