import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { disconnectControlPrisma } from '../lib/control-prisma';
import { disconnectRedis, redis } from '../lib/redis';
import { tenantHarness } from '../test/gql';
import { provisionTestTenant } from '../test/tenants';

/**
 * N+1 guard: the number of SQL queries for a nested list must not grow with
 * the number of items. DataLoaders batch each field into one query.
 */
const h = tenantHarness('t-batch');
let owner: string;
let memberIds: string[];

const NESTED = `{ projects { id createdBy { name } members { name } statuses { name } labels { name } taskCount } }`;

async function queriesFor(query: string): Promise<number> {
  h.counter.queries = 0;
  const r = await h.gql(owner, query);
  expect(r.errors).toBeUndefined();
  return h.counter.queries;
}

async function addProjects(n: number, offset: number) {
  for (let i = 0; i < n; i++) {
    await h.gql(
      owner,
      'mutation($c: String!, $m: [ID!]) { createProject(input: { title: $c, shortCode: $c, memberIds: $m }) { id } }',
      {
        c: `P${offset + i}`,
        m: memberIds,
      },
    );
  }
}

beforeAll(async () => {
  await redis().flushdb();
  await provisionTestTenant('t-batch', { projectLimit: 50 });
  owner = await h.ownerLogin();
  memberIds = [
    (await h.createUser(owner, 'a@t-batch.test', 'MEMBER')).id,
    (await h.createUser(owner, 'b@t-batch.test', 'ADMIN')).id,
  ];
});
afterAll(async () => {
  await h.pool.clear();
  await disconnectControlPrisma();
  await disconnectRedis();
});

describe('DataLoader batching', () => {
  it('runs the same number of queries for 2 projects and for 12', async () => {
    await addProjects(2, 0);
    const small = await queriesFor(NESTED);
    await addProjects(10, 2);
    const large = await queriesFor(NESTED);
    expect(large).toBe(small);
    // auth user, projects, createdBy, members (+ their users), statuses, labels, taskCount
    expect(small).toBeLessThanOrEqual(8);
  });
});
