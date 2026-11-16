import express from 'express';

export function createApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });
  // Used by nginx auth_request before serving tenant pages. Real lookup comes in D5.
  app.get('/api/internal/tenant-check', (_req, res) => {
    res.sendStatus(403);
  });
  return app;
}
