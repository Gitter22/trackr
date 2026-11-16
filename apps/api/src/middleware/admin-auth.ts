import type { RequestHandler } from 'express';
import { env } from '../config/env';
import { ADMIN_AUDIENCE, verifyToken } from '../lib/jwt';
import { HttpError } from '../lib/http';

export const ADMIN_COOKIE = 'trcker_admin';

declare module 'express-serve-static-core' {
  interface Request {
    adminId?: string;
  }
}

/** Admin API only answers on admin.<APP_DOMAIN>, never on a tenant host. */
export const requireAdminHost: RequestHandler = (req, _res, next) => {
  const host = (req.get('host') ?? '').split(':')[0];
  if (req.get('x-tenant-slug') || host !== `admin.${env().APP_DOMAIN}`) {
    throw new HttpError(404, 'Not found', 'NOT_FOUND');
  }
  next();
};

export const requireAdmin: RequestHandler = (req, _res, next) => {
  const token = req.cookies?.[ADMIN_COOKIE];
  if (!token) throw new HttpError(401, 'Not signed in', 'UNAUTHENTICATED');
  try {
    req.adminId = verifyToken(token, ADMIN_AUDIENCE).sub;
  } catch {
    throw new HttpError(401, 'Session expired', 'UNAUTHENTICATED');
  }
  next();
};
