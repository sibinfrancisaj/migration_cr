import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { adminLogin } from '@/api/auth';
import { saveToken } from '@/lib/token';
import type { AdminUser } from '@/types';

export function LoginPage() {
  const { admin, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [totp, setTotp]         = useState('');
  const [needsTotp, setNeedsTotp] = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  if (admin) return <Navigate to="/" replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await adminLogin(email, password, needsTotp ? totp : undefined);
      saveToken(data.token);
      login(data.token, data.admin as AdminUser);
      navigate('/');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      if (msg?.toLowerCase().includes('totp')) {
        setNeedsTotp(true);
        setError('Enter your 6-digit authenticator code below.');
      } else {
        setError(msg ?? 'Invalid credentials');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-brand-600 mb-3">
            <span className="text-white font-bold text-xl">A</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Abroad Matrimony</h1>
          <p className="text-sm text-gray-500 mt-0.5">Admin Panel</p>
        </div>

        <div className="card p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Sign in to continue</h2>

          {error && (
            <div className="mb-4 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                autoComplete="email"
                required
                className="input"
                placeholder="admin@abroadmatrimony.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="label">Password</label>
              <input
                type="password"
                autoComplete="current-password"
                required
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {needsTotp && (
              <div>
                <label className="label">Authenticator Code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                  className="input text-center tracking-widest text-lg"
                  placeholder="000000"
                  value={totp}
                  onChange={(e) => setTotp(e.target.value.replace(/\D/g, ''))}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-2.5"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4">
          Abroad Matrimony Admin · Authorised access only
        </p>
      </div>
    </div>
  );
}
