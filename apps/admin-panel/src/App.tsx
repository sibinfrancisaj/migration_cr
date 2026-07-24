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
import VerificationPage from '@/pages/verification/VerificationPage';
import ModerationPage from '@/pages/moderation/ModerationPage';
import IntroductionsPage from '@/pages/introductions/IntroductionsPage';
import GroupsPage from '@/pages/groups/GroupsPage';
import EventsPage from '@/pages/events/EventsPage';
import PromptsPage from '@/pages/prompts/PromptsPage';
import PaymentsPage from '@/pages/payments/PaymentsPage';
import AiMonitoringPage from '@/pages/ai/AiMonitoringPage';
import FeatureFlagsPage from '@/pages/flags/FeatureFlagsPage';
import SystemConfigPage from '@/pages/config/SystemConfigPage';
import AuditLogPage from '@/pages/audit/AuditLogPage';
import SeederPage from '@/pages/seeder/SeederPage';

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
              <Route path="verification"  element={<VerificationPage />} />
              <Route path="moderation"    element={<ModerationPage />} />
              <Route path="introductions" element={<IntroductionsPage />} />
              <Route path="groups"        element={<GroupsPage />} />
              <Route path="events"        element={<EventsPage />} />
              <Route path="prompts"       element={<PromptsPage />} />
              <Route path="payments"      element={<PaymentsPage />} />
              <Route path="ai"            element={<AiMonitoringPage />} />
              <Route path="flags"         element={<FeatureFlagsPage />} />
              <Route path="config"        element={<SystemConfigPage />} />
              <Route path="audit"         element={<AuditLogPage />} />
              <Route path="seeder"        element={<SeederPage />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthContext.Provider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
