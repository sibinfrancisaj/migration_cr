/**
 * Thin fetch wrapper for E2E journey tests.
 *
 * Usage:
 *   const client = makeClient(gatewayUrl, authHeader);
 *   const res = await client.get('/api/v1/profile/me');
 *   expect(res.status).toBe(200);
 */

export interface ApiResponse {
  status: number;
  body: unknown;
  headers: Record<string, string>;
}

export interface E2eClient {
  get(path: string, extraHeaders?: Record<string, string>): Promise<ApiResponse>;
  post(path: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<ApiResponse>;
  put(path: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<ApiResponse>;
  patch(path: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<ApiResponse>;
  del(path: string): Promise<ApiResponse>;
}

async function request(
  baseUrl: string,
  method: string,
  path: string,
  authHeader: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<ApiResponse> {
  const url = `${baseUrl}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': authHeader,
    'X-Request-ID': `e2e-${Date.now()}`,
    ...extraHeaders,
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const responseHeaders: Record<string, string> = {};
  res.headers.forEach((value, key) => { responseHeaders[key] = value; });

  let responseBody: unknown;
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    responseBody = await res.json();
  } else {
    responseBody = await res.text();
  }

  return { status: res.status, body: responseBody, headers: responseHeaders };
}

export function makeClient(baseUrl: string, authHeader: string): E2eClient {
  return {
    get:   (path, extra) => request(baseUrl, 'GET',    path, authHeader, undefined, extra),
    post:  (path, body, extra) => request(baseUrl, 'POST',   path, authHeader, body, extra),
    put:   (path, body, extra) => request(baseUrl, 'PUT',    path, authHeader, body, extra),
    patch: (path, body, extra) => request(baseUrl, 'PATCH',  path, authHeader, body, extra),
    del:   (path)              => request(baseUrl, 'DELETE', path, authHeader),
  };
}

/** Unauthenticated client for public endpoints (health, unsubscribe, etc.) */
export function makeAnonClient(baseUrl: string): E2eClient {
  return makeClient(baseUrl, '');
}
