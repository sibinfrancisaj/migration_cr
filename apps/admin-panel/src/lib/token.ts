// Token stored in localStorage, admin object kept only in memory (React state).
// On page refresh the token is re-read; the admin object is re-fetched from /admin/me
// or decoded from the JWT payload (we use the payload approach for simplicity).

const KEY = 'am_admin_token';

export function saveToken(token: string): void {
  localStorage.setItem(KEY, token);
}

export function getToken(): string | null {
  return localStorage.getItem(KEY);
}

export function clearToken(): void {
  localStorage.removeItem(KEY);
}

/** Decode the JWT payload WITHOUT verification (verification happens server-side). */
export function decodePayload<T = Record<string, unknown>>(token: string): T | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1]!;
    const padded = payload + '='.repeat((4 - (payload.length % 4)) % 4);
    return JSON.parse(atob(padded)) as T;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string): boolean {
  const payload = decodePayload<{ exp?: number }>(token);
  if (!payload?.exp) return true;
  return Date.now() / 1000 > payload.exp;
}
