import { env } from '../config/env';
import { decrypt } from '../lib/crypto';

export interface TenantDbRef {
  dbName: string;
  dbUser: string;
  dbPasswordEnc: string;
}

/**
 * Connection URL for one tenant DB, using that tenant's own role.
 * connection_limit caps the Prisma pool per tenant (10 tenants x 5 = 50 max).
 */
export function tenantDatabaseUrl(ref: TenantDbRef, opts: { pool?: boolean } = { pool: true }): string {
  const e = env();
  const url = new URL(`postgresql://${e.POSTGRES_HOST}:${e.POSTGRES_PORT}/${ref.dbName}`);
  url.username = ref.dbUser;
  url.password = decrypt(ref.dbPasswordEnc);
  if (opts.pool) url.searchParams.set('connection_limit', String(e.TENANT_DB_CONNECTION_LIMIT));
  return url.toString();
}
