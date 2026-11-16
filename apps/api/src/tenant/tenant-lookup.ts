import { env } from '../config/env';
import { tenantCacheKey } from '../control/tenant-cache';
import { controlPrisma } from '../lib/control-prisma';
import { redis } from '../lib/redis';

/** What the request pipeline needs to know about a tenant. Cached in Redis. */
export interface TenantInfo {
  id: string;
  slug: string;
  title: string;
  status: 'PROVISIONING' | 'ACTIVE' | 'INACTIVE' | 'FAILED';
  timezone: string;
  dbName: string;
  dbUser: string;
  /** Still encrypted; only decrypted when building the connection URL. */
  dbPasswordEnc: string;
}

/** Unknown slugs are cached briefly too, so random subdomains don't hammer the control DB. */
const NOT_FOUND = '__none__';
const NOT_FOUND_TTL_SECONDS = 30;

export async function lookupTenant(slug: string): Promise<TenantInfo | null> {
  const key = tenantCacheKey(slug);
  const cached = await redis().get(key);
  if (cached === NOT_FOUND) return null;
  if (cached) return JSON.parse(cached) as TenantInfo;

  const org = await controlPrisma().organization.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      status: true,
      timezone: true,
      dbName: true,
      dbUser: true,
      dbPasswordEnc: true,
    },
  });
  if (!org) {
    await redis().set(key, NOT_FOUND, 'EX', NOT_FOUND_TTL_SECONDS);
    return null;
  }
  await redis().set(key, JSON.stringify(org), 'EX', env().TENANT_CACHE_TTL_SECONDS);
  return org;
}
