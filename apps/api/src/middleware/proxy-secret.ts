import type { RequestHandler } from 'express';
import { env } from '../config/env';

/**
 * Only Nginx (Docker) or the Vite dev proxy know PROXY_SECRET. Anything else is
 * a request that skipped the proxy, so its X-Tenant-Slug can't be trusted.
 * /api/health stays open for container health checks.
 */
export const requireProxySecret: RequestHandler = (req, res, next) => {
  if (req.path === '/api/health') return next();
  if (req.get('x-proxy-secret') !== env().PROXY_SECRET) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Direct access not allowed' } });
    return;
  }
  next();
};
