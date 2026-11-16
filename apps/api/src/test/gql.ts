import { PrismaClient } from '../generated/tenant';
import { createApp } from '../app';
import { env } from '../config/env';
import { TenantClientPool } from '../tenant/tenant-pool';
import { api } from './http';

/**
 * Test harness for one tenant: an app whose tenant Prisma clients count SQL
 * queries, plus helpers to log in and run GraphQL as a given user.
 */
export function tenantHarness(slug: string) {
  const counter = { queries: 0 };
  const pool = new TenantClientPool(5, (url) => {
    const client = new PrismaClient({
      datasources: { db: { url } },
      log: [{ emit: 'event', level: 'query' }],
    });
    client.$on('query', () => {
      counter.queries++;
    });
    return client;
  });
  const app = createApp({ pool });
  const http = () => api(`${slug}.${env().APP_DOMAIN}`, slug, app);

  async function login(email: string, password: string): Promise<string> {
    const res = await http().post('/api/tenant/auth/login').send({ email, password });
    if (res.status !== 200) throw new Error(`login ${email}: ${res.status} ${JSON.stringify(res.body)}`);
    return res.body.token;
  }

  async function gql<T = Record<string, unknown>>(
    token: string,
    query: string,
    variables: Record<string, unknown> = {},
  ) {
    const res = await http()
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send({ query, variables });
    return res.body as { data?: T; errors?: { message: string; extensions?: { code?: string } }[] };
  }

  /** Owner creates a user via REST and returns their token. */
  async function createUser(ownerToken: string, email: string, role: 'ADMIN' | 'MEMBER' | 'VIEWER') {
    const res = await http()
      .post('/api/tenant/users')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: email.split('@')[0], email, role });
    if (res.status !== 201) throw new Error(`create user: ${res.status}`);
    return { id: res.body.user.id as string, token: await login(email, 'User@123') };
  }

  return {
    app,
    pool,
    http,
    login,
    gql,
    createUser,
    counter,
    ownerLogin: () => login(`owner@${slug}.test`, 'OrgOwner@123'),
  };
}

export const errorCode = (r: { errors?: { extensions?: { code?: string } }[] }) =>
  r.errors?.[0]?.extensions?.code;
