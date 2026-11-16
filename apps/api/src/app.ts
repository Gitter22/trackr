import cookieParser from 'cookie-parser';
import express, { Router } from 'express';
import { errorHandler } from './lib/http';
import { requireAdmin, requireAdminHost } from './middleware/admin-auth';
import { requireProxySecret } from './middleware/proxy-secret';
import { adminAuthRouter } from './rest/admin/auth.routes';
import { adminUsersRouter } from './rest/admin/users.routes';

export function createApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });
  app.use(requireProxySecret);

  // Used by nginx auth_request before serving tenant pages. Real lookup comes in D5.
  app.get('/api/internal/tenant-check', (_req, res) => {
    res.sendStatus(403);
  });

  // Control panel (admin.<APP_DOMAIN>)
  const admin = Router();
  admin.use(requireAdminHost);
  admin.use('/auth', adminAuthRouter);
  admin.use('/users', requireAdmin, adminUsersRouter);
  app.use('/api/admin', admin);

  app.use('/api', (_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found' } });
  });
  app.use(errorHandler);
  return app;
}
