import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app';
import { seedSuperAdmin } from '../../control/seed';
import { controlPrisma, disconnectControlPrisma } from '../../lib/control-prisma';
import { env } from '../../config/env';
import { adminHost, api } from '../../test/http';

beforeAll(async () => {
  await seedSuperAdmin();
});
afterAll(disconnectControlPrisma);

describe('admin auth', () => {
  it('seeding twice keeps one super admin', async () => {
    await seedSuperAdmin();
    expect(await controlPrisma().superAdmin.count()).toBe(1);
  });

  it('rejects requests that skip the proxy', async () => {
    const res = await request(createApp()).get('/api/admin/auth/me').set('Host', adminHost());
    expect(res.status).toBe(403);
  });

  it('admin API is not served on a tenant host', async () => {
    const res = await api(`kiksasa.${env().APP_DOMAIN}`, 'kiksasa').post('/api/admin/auth/login').send({});
    expect(res.status).toBe(404);
  });

  it('rejects a wrong password', async () => {
    const res = await api(adminHost())
      .post('/api/admin/auth/login')
      .send({ email: 'superadmin@trackr.com', password: 'nope' });
    expect(res.status).toBe(401);
  });

  it('logs in with a host-only httpOnly cookie and returns me', async () => {
    const client = api(adminHost());
    const login = await client
      .post('/api/admin/auth/login')
      .send({ email: 'SuperAdmin@trackr.com', password: 'Test@123' });
    expect(login.status).toBe(200);
    const cookie = String(login.headers['set-cookie']);
    expect(cookie).toMatch(/trcker_admin=.*HttpOnly/);
    expect(cookie).not.toMatch(/Domain=/i);
    const me = await client.get('/api/admin/auth/me');
    expect(me.body.admin.email).toBe('superadmin@trackr.com');
  });
});

describe('admin users', () => {
  it('requires a session', async () => {
    expect((await api(adminHost()).get('/api/admin/users')).status).toBe(401);
  });

  it('creates and lists org owners, rejects duplicates and bad input', async () => {
    const client = api(adminHost());
    await client.post('/api/admin/auth/login').send({ email: 'superadmin@trackr.com', password: 'Test@123' });

    const created = await client
      .post('/api/admin/users')
      .send({ name: 'John Doe', email: 'John.Doe@example.com' });
    expect(created.status).toBe(201);
    expect(created.body.user.email).toBe('john.doe@example.com');

    const dup = await client.post('/api/admin/users').send({ name: 'J', email: 'john.doe@example.com' });
    expect(dup.status).toBe(409);

    const bad = await client.post('/api/admin/users').send({ name: '', email: 'x' });
    expect(bad.status).toBe(400);
    expect(Object.keys(bad.body.error.details.fieldErrors)).toEqual(
      expect.arrayContaining(['name', 'email']),
    );

    const list = await client.get('/api/admin/users');
    expect(list.body.users.map((u: { email: string }) => u.email)).toContain('john.doe@example.com');
  });
});
