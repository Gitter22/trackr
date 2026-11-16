import type { RequestHandler } from 'express';
import { HttpError } from '../lib/http';
import { lookupTenant, type TenantInfo } from '../tenant/tenant-lookup';

declare module 'express-serve-static-core' {
  interface Request {
    tenant?: TenantInfo;
  }
}

const SLUG = /^[a-z0-9-]{1,32}$/;

/** X-Tenant-Slug is set by Nginx / the Vite proxy from the Host (never trusted from the client). */
export const resolveTenant: RequestHandler = async (req, _res, next) => {
  const slug = (req.get('x-tenant-slug') ?? '').toLowerCase();
  const tenant = SLUG.test(slug) ? await lookupTenant(slug) : null;
  if (!tenant || tenant.status !== 'ACTIVE') {
    throw new HttpError(404, 'Workspace not found', 'TENANT_NOT_FOUND');
  }
  req.tenant = tenant;
  next();
};
