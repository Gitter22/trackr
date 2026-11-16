import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { tenantCacheKey } from '../../control/tenant-cache';
import { controlPrisma, disconnectControlPrisma } from '../../lib/control-prisma';
import { signToken, tenantAudience } from '../../lib/jwt';
import { disconnectRedis, redis } from '../../lib/redis';
import { env } from '../../config/env';
import { api } from '../../test/http';
import { provisionTestTenant } from '../../test/tenants';
import { createApp } from '../../app';
import { lookupTenant } from '../../tenant/tenant-lookup';
import { TenantClientPool } from '../../tenant/tenant-pool';

const host = (slug: string) => `${slug}.${env().APP_DOMAIN}`;
const pool = new TenantClientPool(5);
const app = createApp({ pool });

beforeAll(async () => {
  await redis().flushdb();
  await provisionTestTenant('t-alpha');
  await provisionTestTenant('t-beta');
});
afterAll(async () => {
  await pool.clear();
  await disconnectControlPrisma();
  await disconnectRedis();
});

async function login(slug: string, email = `owner@${slug}.test`, password = 'OrgOwner@123') {
  return api(host(slug), slug, app).post('/api/tenant/auth/login').send({ email, password });
}

describe('tenant resolver', () => {
  it('404s an unknown tenant and caches the miss', async () => {
    const res = await api(host('t-nope'), 't-nope', app).get('/api/tenant/auth/me');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('TENANT_NOT_FOUND');
    expect(await redis().get(tenantCacheKey('t-nope'))).toBe('__none__');
  });

  it('caches an active tenant for 60s and serves later requests from Redis', async () => {
    await redis().del(tenantCacheKey('t-alpha'));
    const { body } = await login('t-alpha');
    expect(await redis().ttl(tenantCacheKey('t-alpha'))).toBeGreaterThan(55);
    // Change the cached copy only: if the next request shows it, it came from Redis.
    const cached = JSON.parse((await redis().get(tenantCacheKey('t-alpha')))!);
    await redis().set(
      tenantCacheKey('t-alpha'),
      JSON.stringify({ ...cached, title: 'from-cache' }),
      'KEEPTTL',
    );
    const me = await api(host('t-alpha'), 't-alpha', app)
      .get('/api/tenant/auth/me')
      .set('Authorization', `Bearer ${body.token}`);
    expect(me.body.org.title).toBe('from-cache');
    await redis().del(tenantCacheKey('t-alpha'));
  });

  it('404s an inactive tenant', async () => {
    await controlPrisma().organization.update({ where: { slug: 't-beta' }, data: { status: 'INACTIVE' } });
    await redis().del(tenantCacheKey('t-beta'));
    expect((await login('t-beta')).status).toBe(404);
    await controlPrisma().organization.update({ where: { slug: 't-beta' }, data: { status: 'ACTIVE' } });
    await redis().del(tenantCacheKey('t-beta'));
  });

  it('nginx tenant-check answers 204 for active and 403 otherwise', async () => {
    expect((await api(host('t-alpha'), 't-alpha', app).get('/api/internal/tenant-check')).status).toBe(204);
    expect((await api(host('t-nope'), 't-nope', app).get('/api/internal/tenant-check')).status).toBe(403);
  });

  it('keeps one pooled client per tenant', () => {
    expect(pool.has('t-alpha')).toBe(true);
    expect(pool.has('t-nope')).toBe(false);
  });
});

describe('tenant auth', () => {
  it('logs in and returns me', async () => {
    const res = await login('t-alpha');
    expect(res.status).toBe(200);
    const me = await api(host('t-alpha'), 't-alpha', app)
      .get('/api/tenant/auth/me')
      .set('Authorization', `Bearer ${res.body.token}`);
    expect(me.body.user).toMatchObject({ email: 'owner@t-alpha.test', role: 'OWNER' });
    expect(me.body.org.slug).toBe('t-alpha');
  });

  it('rejects a wrong password', async () => {
    expect((await login('t-alpha', 'owner@t-alpha.test', 'bad')).status).toBe(401);
  });

  it("rejects alpha's token on beta, even for a user id that exists there", async () => {
    const { body } = await login('t-alpha');
    const res = await api(host('t-beta'), 't-beta', app)
      .get('/api/tenant/auth/me')
      .set('Authorization', `Bearer ${body.token}`);
    expect(res.status).toBe(401);
  });

  it('ends old sessions when tokenVersion is bumped, and blocks inactive users', async () => {
    const { body } = await login('t-alpha');
    const db = pool.get((await lookupTenant('t-alpha'))!);
    const me = () =>
      api(host('t-alpha'), 't-alpha', app)
        .get('/api/tenant/auth/me')
        .set('Authorization', `Bearer ${body.token}`);
    expect((await me()).status).toBe(200);
    await db.user.update({ where: { id: body.user.id }, data: { tokenVersion: { increment: 1 } } });
    expect((await me()).status).toBe(401);
    // fresh token, then deactivate
    const fresh = await login('t-alpha');
    await db.user.update({ where: { id: body.user.id }, data: { isActive: false } });
    const res = await api(host('t-alpha'), 't-alpha', app)
      .get('/api/tenant/auth/me')
      .set('Authorization', `Bearer ${fresh.body.token}`);
    expect(res.status).toBe(401);
    await db.user.update({ where: { id: body.user.id }, data: { isActive: true } });
  });

  it('rejects a token signed for the admin audience', async () => {
    const token = signToken({ sub: 'x', ver: 0 }, 'admin');
    const res = await api(host('t-alpha'), 't-alpha', app)
      .get('/api/tenant/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(tenantAudience('t-alpha')).toBe('tenant:t-alpha');
  });
});
