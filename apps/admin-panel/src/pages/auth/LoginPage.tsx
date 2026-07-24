import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { adminLogin } from '@/api/auth';
import { saveToken } from '@/lib/token';
import type { AdminUser } from '@/types';

export function LoginPage() {
  const { admin, login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [totp, setTotp]           = useState('');
  const [needsTotp, setNeedsTotp] = useState(false);
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);

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
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #2C1A0E 0%, #4A3728 50%, #78350f 100%)' }}
    >
      {/* Decorative glow */}
      <div className="absolute inset-0 opacity-10 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(circle at 25% 35%, #f59e0b 0%, transparent 50%), radial-gradient(circle at 75% 65%, #d97706 0%, transparent 50%)' }}
      />

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3 shadow-lg"
            style={{ backgroundColor: '#f59e0b', boxShadow: '0 10px 25px -5px rgba(120,53,15,0.5)' }}
          >
            <span className="font-bold text-2xl" style={{ color: '#2C1A0E' }}>A</span>
          </div>
          <h1 className="text-xl font-bold" style={{ color: '#fef3c7' }}>Abroad Matrimony</h1>
          <p className="text-sm mt-0.5" style={{ color: '#fbbf24' }}>Admin Panel</p>
        </div>

        <div
          className="rounded-2xl shadow-2xl p-6"
          style={{ backgroundColor: 'rgba(255,255,255,0.97)', border: '1px solid rgba(251,191,36,0.2)' }}
        >
          <h2 className="text-base font-semibold text-stone-900 mb-4">Sign in to continue</h2>

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
              className="w-full justify-center py-2.5 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 shadow-sm"
              style={{ backgroundColor: loading ? '#b45309' : '#d97706' }}
              onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.backgroundColor = '#b45309'; }}
              onMouseLeave={(e) => { if (!loading) (e.target as HTMLButtonElement).style.backgroundColor = '#d97706'; }}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-4" style={{ color: 'rgba(251,191,36,0.6)' }}>
          Abroad Matrimony Admin · Authorised access only
        </p>
      </div>
    </div>
  );
}
