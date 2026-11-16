import { LRUCache } from 'lru-cache';
import { PrismaClient } from '../generated/tenant';
import { tenantDatabaseUrl } from '../control/tenant-url';
import type { TenantInfo } from './tenant-lookup';

interface Entry {
  url: string;
  client: PrismaClient;
}

export type ClientFactory = (url: string) => PrismaClient;

const defaultFactory: ClientFactory = (url) => new PrismaClient({ datasources: { db: { url } } });

/**
 * One PrismaClient per active tenant, kept in an LRU cache. The URL carries
 * connection_limit, so total connections <= max * TENANT_DB_CONNECTION_LIMIT.
 * Evicted clients are disconnected.
 */
export class TenantClientPool {
  private cache: LRUCache<string, Entry>;
  private closing = new Set<Promise<void>>();

  constructor(
    max: number,
    private readonly factory: ClientFactory = defaultFactory,
    private readonly urlOf: (t: TenantInfo) => string = (t) => tenantDatabaseUrl(t),
  ) {
    this.cache = new LRUCache<string, Entry>({
      max,
      dispose: (entry) => {
        const p = entry.client.$disconnect().finally(() => this.closing.delete(p));
        this.closing.add(p);
      },
    });
  }

  get(tenant: TenantInfo): PrismaClient {
    const url = this.urlOf(tenant);
    const hit = this.cache.get(tenant.slug);
    // Same slug but new credentials (e.g. re-provisioned): replace, which disposes the old one.
    if (hit && hit.url === url) return hit.client;
    const client = this.factory(url);
    this.cache.set(tenant.slug, { url, client });
    return client;
  }

  get size(): number {
    return this.cache.size;
  }

  has(slug: string): boolean {
    return this.cache.has(slug);
  }

  /** Disconnects every client (used on shutdown). */
  async clear(): Promise<void> {
    this.cache.clear();
    await Promise.all([...this.closing]);
  }
}
