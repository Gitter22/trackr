import type { Request } from 'express';
import type { PrismaClient, User } from '../generated/tenant';
import type { TenantInfo } from '../tenant/tenant-lookup';
import { createLoaders, type Loaders } from './loaders';

export interface GraphQLContext {
  prisma: PrismaClient;
  user: User;
  tenant: TenantInfo;
  loaders: Loaders;
}

/** Runs per request after the tenant pipeline and auth middleware filled req. */
export function buildContext({ req }: { req: Request }): GraphQLContext {
  const prisma = req.prisma!;
  const user = req.user!;
  return { prisma, user, tenant: req.tenant!, loaders: createLoaders(prisma, user.id) };
}
