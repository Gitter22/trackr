import cookieParser from 'cookie-parser';
import express, { Router } from 'express';
import { env } from './config/env';
import { errorHandler } from './lib/http';
import { redis } from './lib/redis';
import { requireAdmin, requireAdminHost } from './middleware/admin-auth';
import { requireProxySecret } from './middleware/proxy-secret';
import { rateLimit } from './middleware/rate-limit';
import { attachTenantPrisma } from './middleware/tenant-prisma';
import { resolveTenant } from './middleware/tenant-resolver';
import { adminAuthRouter } from './rest/admin/auth.routes';
import { adminOrgsRouter } from './rest/admin/orgs.routes';
import { adminUsersRouter } from './rest/admin/users.routes';
import { tenantAuthRouter } from './rest/tenant/auth.routes';
import { tenantUsersRouter } from './rest/tenant/users.routes';
import { requireTenantUser } from './middleware/tenant-auth';
import { lookupTenant } from './tenant/tenant-lookup';
import { TenantClientPool } from './tenant/tenant-pool';

export interface AppDeps {
  pool?: TenantClientPool;
}

export function createApp(deps: AppDeps = {}): express.Express {
  const e = env();
  const pool = deps.pool ?? new TenantClientPool(e.TENANT_CLIENT_CACHE_MAX);
  const app = express();
  app.locals.pool = pool;
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });
  app.use(requireProxySecret);

  // Nginx auth_request before serving tenant pages: 204 = serve, 403 = show 404 page.
  app.get('/api/internal/tenant-check', async (req, res) => {
    const slug = (req.get('x-tenant-slug') ?? '').toLowerCase();
    const tenant = slug ? await lookupTenant(slug) : null;
    res.sendStatus(tenant?.status === 'ACTIVE' ? 204 : 403);
  });

  // Control panel (admin.<APP_DOMAIN>)
  const admin = Router();
  admin.use(requireAdminHost);
  admin.use('/auth', adminAuthRouter);
  admin.use('/users', requireAdmin, adminUsersRouter);
  admin.use('/organizations', requireAdmin, adminOrgsRouter);
  app.use('/api/admin', admin);

  // Tenant pipeline: tenant -> rate limit -> DB client -> (auth per route)
  const tenantPipeline = [
    resolveTenant,
    rateLimit({
      redis,
      capacity: e.RATE_LIMIT_CAPACITY,
      refillPerSec: e.RATE_LIMIT_REFILL_PER_SEC,
      keyOf: (req) => req.tenant!.slug,
    }),
    attachTenantPrisma(pool),
  ];
  const tenant = Router();
  tenant.use(...tenantPipeline);
  // Public: lets the web app show the login page or a 404 for this subdomain.
  tenant.get('/status', (req, res) => {
    const t = req.tenant!;
    res.json({ org: { slug: t.slug, title: t.title, timezone: t.timezone } });
  });
  tenant.use('/auth', tenantAuthRouter);
  tenant.use('/users', requireTenantUser, tenantUsersRouter);
  app.use('/api/tenant', tenant);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } });
  });
  app.use(errorHandler);
  return app;
}
