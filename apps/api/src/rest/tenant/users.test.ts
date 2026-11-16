import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { env } from '../../config/env';
import { tenantCacheKey } from '../../control/tenant-cache';
import { controlPrisma, disconnectControlPrisma } from '../../lib/control-prisma';
import { disconnectRedis, redis } from '../../lib/redis';
import { api } from '../../test/http';
import { provisionTestTenant } from '../../test/tenants';
import { TenantClientPool } from '../../tenant/tenant-pool';

const SLUG = 't-users';
const pool = new TenantClientPool(5);
const app = createApp({ pool });
const client = () => api(`${SLUG}.${env().APP_DOMAIN}`, SLUG, app);

async function tokenFor(email: string, password: string): Promise<string> {
  const res = await client().post('/api/tenant/auth/login').send({ email, password });
  expect(res.status, `login ${email}`).toBe(200);
  return res.body.token;
}
const as = (token: string) => ({
  get: (url: string) => client().get(url).set('Authorization', `Bearer ${token}`),
  post: (url: string) => client().post(url).set('Authorization', `Bearer ${token}`),
  patch: (url: string) => client().patch(url).set('Authorization', `Bearer ${token}`),
});

let owner: ReturnType<typeof as>;
let ownerId: string;

beforeAll(async () => {
  await redis().flushdb();
  await provisionTestTenant(SLUG);
  const token = await tokenFor(`owner@${SLUG}.test`, 'OrgOwner@123');
  owner = as(token);
  ownerId = (await owner.get('/api/tenant/auth/me')).body.user.id;
});
afterAll(async () => {
  await pool.clear();
  await disconnectControlPrisma();
  await disconnectRedis();
});

describe('tenant status', () => {
  it('is public and returns the org', async () => {
    const res = await client().get('/api/tenant/status');
    expect(res.body.org).toEqual({ slug: SLUG, title: `Org ${SLUG}`, timezone: 'UTC' });
  });

  it('404s when the org is inactive', async () => {
    await controlPrisma().organization.update({ where: { slug: SLUG }, data: { status: 'INACTIVE' } });
    await redis().del(tenantCacheKey(SLUG));
    expect((await client().get('/api/tenant/status')).status).toBe(404);
    await controlPrisma().organization.update({ where: { slug: SLUG }, data: { status: 'ACTIVE' } });
    await redis().del(tenantCacheKey(SLUG));
  });
});

describe('tenant users', () => {
  let adminId: string;

  it('owner creates users who sign in with the default password', async () => {
    const res = await owner
      .post('/api/tenant/users')
      .send({ name: 'Ada', email: 'Ada@Example.com', role: 'ADMIN' });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: 'ada@example.com', role: 'ADMIN', isActive: true });
    adminId = res.body.user.id;
    await tokenFor('ada@example.com', 'User@123');
  });

  it('rejects OWNER role, bad input and duplicates', async () => {
    expect(
      (await owner.post('/api/tenant/users').send({ name: 'X', email: 'x@x.com', role: 'OWNER' })).status,
    ).toBe(400);
    expect(
      (await owner.post('/api/tenant/users').send({ name: '', email: 'nope', role: 'MEMBER' })).status,
    ).toBe(400);
    expect(
      (await owner.post('/api/tenant/users').send({ name: 'A', email: 'ada@example.com', role: 'MEMBER' }))
        .status,
    ).toBe(409);
  });

  it('admin can list users but not create or change them', async () => {
    const admin = as(await tokenFor('ada@example.com', 'User@123'));
    const list = await admin.get('/api/tenant/users');
    expect(list.status).toBe(200);
    expect(list.body.users.map((u: { email: string }) => u.email)).toContain(`owner@${SLUG}.test`);
    expect(
      (await admin.post('/api/tenant/users').send({ name: 'B', email: 'b@x.com', role: 'MEMBER' })).status,
    ).toBe(403);
    expect((await admin.patch(`/api/tenant/users/${ownerId}`).send({ isActive: false })).status).toBe(403);
  });

  it('changing a role ends that user’s sessions', async () => {
    const adaToken = await tokenFor('ada@example.com', 'User@123');
    const res = await owner.patch(`/api/tenant/users/${adminId}`).send({ role: 'VIEWER' });
    expect(res.body.user.role).toBe('VIEWER');
    expect((await as(adaToken).get('/api/tenant/auth/me')).status).toBe(401);
  });

  it('deactivated users cannot sign in; reactivating lets them back', async () => {
    await owner.patch(`/api/tenant/users/${adminId}`).send({ isActive: false });
    expect(
      (await client().post('/api/tenant/auth/login').send({ email: 'ada@example.com', password: 'User@123' }))
        .status,
    ).toBe(401);
    await owner.patch(`/api/tenant/users/${adminId}`).send({ isActive: true });
    await tokenFor('ada@example.com', 'User@123');
  });

  it('owner cannot change their own role or status', async () => {
    expect((await owner.patch(`/api/tenant/users/${ownerId}`).send({ isActive: false })).status).toBe(403);
    expect((await owner.patch(`/api/tenant/users/${ownerId}`).send({ name: 'Boss' })).status).toBe(200);
  });

  it('requires a session', async () => {
    expect((await client().get('/api/tenant/users')).status).toBe(401);
  });
});
