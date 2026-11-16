import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '../generated/tenant';
import type { TenantInfo } from './tenant-lookup';
import { TenantClientPool } from './tenant-pool';

const tenant = (slug: string, pw = 'x'): TenantInfo => ({
  id: slug,
  slug,
  title: slug,
  status: 'ACTIVE',
  timezone: 'UTC',
  dbName: `tenant_${slug}_db`,
  dbUser: 'u',
  dbPasswordEnc: pw,
});

function fakePool(max: number) {
  const created: { url: string; $disconnect: ReturnType<typeof vi.fn> }[] = [];
  const pool = new TenantClientPool(
    max,
    (url) => {
      const c = { url, $disconnect: vi.fn().mockResolvedValue(undefined) };
      created.push(c);
      return c as unknown as PrismaClient;
    },
    (t) => `postgresql://${t.dbName}?pw=${t.dbPasswordEnc}&connection_limit=5`,
  );
  return { pool, created };
}

describe('TenantClientPool', () => {
  it('reuses one client per tenant', () => {
    const { pool, created } = fakePool(5);
    expect(pool.get(tenant('a'))).toBe(pool.get(tenant('a')));
    expect(created).toHaveLength(1);
    expect(created[0].url).toContain('connection_limit=5');
  });

  it('disconnects the least recently used client when full', () => {
    const { pool, created } = fakePool(2);
    pool.get(tenant('a'));
    pool.get(tenant('b'));
    pool.get(tenant('a')); // a is now most recent
    pool.get(tenant('c')); // evicts b
    expect(pool.has('b')).toBe(false);
    expect(created[1].$disconnect).toHaveBeenCalledOnce();
    expect(created[0].$disconnect).not.toHaveBeenCalled();
    expect(pool.size).toBe(2);
  });

  it('replaces and disconnects a client when the tenant credentials change', () => {
    const { pool, created } = fakePool(5);
    pool.get(tenant('a', 'old'));
    pool.get(tenant('a', 'new'));
    expect(created).toHaveLength(2);
    expect(created[0].$disconnect).toHaveBeenCalledOnce();
  });

  it('clear() disconnects everything', async () => {
    const { pool, created } = fakePool(5);
    pool.get(tenant('a'));
    pool.get(tenant('b'));
    await pool.clear();
    expect(created.every((c) => c.$disconnect.mock.calls.length === 1)).toBe(true);
  });
});
