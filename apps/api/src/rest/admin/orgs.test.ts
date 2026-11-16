import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { tenantCacheKey } from '../../control/tenant-cache';
import { tenantDatabaseUrl } from '../../control/tenant-url';
import { seedSuperAdmin } from '../../control/seed';
import { PrismaClient as TenantPrismaClient } from '../../generated/tenant';
import { controlPrisma, disconnectControlPrisma } from '../../lib/control-prisma';
import { verifyPassword } from '../../lib/password';
import { disconnectRedis, redis } from '../../lib/redis';
import { adminHost, api } from '../../test/http';

const client = api(adminHost());
let ownerId: string;

beforeAll(async () => {
  await seedSuperAdmin();
  await client.post('/api/admin/auth/login').send({ email: 'superadmin@trackr.com', password: 'Test@123' });
  const res = await client.post('/api/admin/users').send({ name: 'Kik Owner', email: 'owner@kiksasa.test' });
  ownerId = res.body.user.id;
});

afterAll(async () => {
  await disconnectControlPrisma();
  await disconnectRedis();
});

const orgInput = (slug: string) => ({
  title: `Org ${slug}`,
  slug,
  ownerId,
  projectLimit: 5,
  timezone: 'Asia/Kolkata',
});

describe('organization provisioning', () => {
  it('rejects bad slugs, reserved slugs and unknown timezones', async () => {
    for (const slug of ['ab', 'Admin', '1abc', 'has_underscore', 'a--b']) {
      expect((await client.post('/api/admin/organizations').send(orgInput(slug))).status, slug).toBe(400);
    }
    const tz = await client
      .post('/api/admin/organizations')
      .send({ ...orgInput('t-tz'), timezone: 'Mars/Base' });
    expect(tz.status).toBe(400);
  });

  it('creates the tenant DB, schema, owner and settings, then marks it ACTIVE', async () => {
    const res = await client.post('/api/admin/organizations').send(orgInput('t-kiksasa'));
    expect(res.status).toBe(201);
    expect(res.body.organization).toMatchObject({
      slug: 't-kiksasa',
      dbName: 'tenant_t_kiksasa_db',
      status: 'ACTIVE',
    });
    expect(res.body.organization).not.toHaveProperty('dbPasswordEnc');

    const org = await controlPrisma().organization.findUniqueOrThrow({ where: { slug: 't-kiksasa' } });
    expect(org.dbPasswordEnc).not.toContain(org.dbUser);
    const tenant = new TenantPrismaClient({ datasources: { db: { url: tenantDatabaseUrl(org) } } });
    try {
      const owner = await tenant.user.findUniqueOrThrow({ where: { email: 'owner@kiksasa.test' } });
      expect(owner.role).toBe('OWNER');
      expect(await verifyPassword('OrgOwner@123', owner.passwordHash)).toBe(true);
      const settings = await tenant.orgSetting.findMany();
      expect(Object.fromEntries(settings.map((s) => [s.key, s.value]))).toMatchObject({
        timezone: 'Asia/Kolkata',
        projectLimit: 5,
      });
      const tables = await tenant.$queryRaw<{ tablename: string }[]>`
        SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`;
      expect(tables.map((t) => t.tablename)).toEqual(
        expect.arrayContaining(['tasks', 'task_statuses', 'projects', 'comments', 'task_activities']),
      );
    } finally {
      await tenant.$disconnect();
    }
  });

  it('rejects a duplicate slug', async () => {
    expect((await client.post('/api/admin/organizations').send(orgInput('t-kiksasa'))).status).toBe(409);
  });

  it("a tenant's DB role cannot open another tenant's database", async () => {
    await client.post('/api/admin/organizations').send(orgInput('t-acme'));
    const kik = await controlPrisma().organization.findUniqueOrThrow({ where: { slug: 't-kiksasa' } });
    const crossUrl = tenantDatabaseUrl({ ...kik, dbName: 'tenant_t_acme_db' });
    const cross = new TenantPrismaClient({ datasources: { db: { url: crossUrl } } });
    await expect(cross.user.count()).rejects.toThrow();
    await cross.$disconnect();
  });

  it('deactivating clears the Redis tenant cache entry', async () => {
    const org = await controlPrisma().organization.findUniqueOrThrow({ where: { slug: 't-kiksasa' } });
    await redis().set(tenantCacheKey('t-kiksasa'), '{"status":"ACTIVE"}');
    const res = await client.patch(`/api/admin/organizations/${org.id}/status`).send({ status: 'INACTIVE' });
    expect(res.body.organization.status).toBe('INACTIVE');
    expect(await redis().get(tenantCacheKey('t-kiksasa'))).toBeNull();
    await client.patch(`/api/admin/organizations/${org.id}/status`).send({ status: 'ACTIVE' });
  });

  it('lists organizations with their owner', async () => {
    const res = await client.get('/api/admin/organizations');
    const kik = res.body.organizations.find((o: { slug: string }) => o.slug === 't-kiksasa');
    expect(kik.owner.email).toBe('owner@kiksasa.test');
  });
});
