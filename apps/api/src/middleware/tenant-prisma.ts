import type { RequestHandler } from 'express';
import type { PrismaClient } from '../generated/tenant';
import type { TenantClientPool } from '../tenant/tenant-pool';

declare module 'express-serve-static-core' {
  interface Request {
    prisma?: PrismaClient;
  }
}

/** Attaches the tenant's pooled PrismaClient. Must run after resolveTenant. */
export const attachTenantPrisma =
  (pool: TenantClientPool): RequestHandler =>
  (req, _res, next) => {
    req.prisma = pool.get(req.tenant!);
    next();
  };
