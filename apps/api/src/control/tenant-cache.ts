import { redis } from '../lib/redis';

export const tenantCacheKey = (slug: string) => `tenant:${slug}`;

/** Called on every org status change so deactivation takes effect at once, not after the TTL. */
export async function invalidateTenantCache(slug: string): Promise<void> {
  await redis().del(tenantCacheKey(slug));
}
