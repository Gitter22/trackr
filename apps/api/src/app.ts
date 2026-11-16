import express from 'express';

export function createApp(): express.Express {
  const app = express();
  app.disable('x-powered-by');
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });
  return app;
}
