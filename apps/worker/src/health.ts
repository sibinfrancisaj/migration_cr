import { createServer, type Server } from 'node:http';

export const HEALTH_PATH = '/health';

/**
 * Minimal liveness endpoint for the worker process — no Express needed.
 * 200 { status: 'ok' } once workers are running, 503 { status: 'starting' | 'stopping' } otherwise.
 */
export function createHealthServer(getStatus: () => 'starting' | 'ok' | 'stopping'): Server {
  return createServer((req, res) => {
    if (req.method !== 'GET' || req.url !== HEALTH_PATH) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'NOT_FOUND' }));
      return;
    }
    const status = getStatus();
    res.writeHead(status === 'ok' ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status, service: 'worker', uptime: process.uptime() }));
  });
}
