import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { disconnectControlPrisma } from '../../lib/control-prisma';
import { disconnectRedis, redis } from '../../lib/redis';
import { lookupTenant } from '../../tenant/tenant-lookup';
import { errorCode, tenantHarness } from '../../test/gql';
import { provisionTestTenant } from '../../test/tenants';

const h = tenantHarness('t-status');
let owner: string;
let member: { id: string; token: string };
let projectId: string;
type S = { id: string; name: string; category: string; position: number };
let statuses: S[];

const STATUSES = 'query($id: ID!) { project(id: $id) { statuses { id name category position } } }';
const list = async () =>
  (await h.gql<{ project: { statuses: S[] } }>(owner, STATUSES, { id: projectId })).data!.project.statuses;
const db = async () => h.pool.get((await lookupTenant('t-status'))!);

beforeAll(async () => {
  await redis().flushdb();
  await provisionTestTenant('t-status');
  owner = await h.ownerLogin();
  member = await h.createUser(owner, 'm@t-status.test', 'MEMBER');
  const r = await h.gql<{ createProject: { id: string } }>(
    owner,
    'mutation($m: [ID!]) { createProject(input: { title: "P", shortCode: "PP", memberIds: $m }) { id } }',
    { m: [member.id] },
  );
  projectId = r.data!.createProject.id;
  statuses = await list();
});
afterAll(async () => {
  await h.pool.clear();
  await disconnectControlPrisma();
  await disconnectRedis();
});

describe('statuses', () => {
  it('inserts a status between two others (fractional position)', async () => {
    const r = await h.gql<{ createStatus: S }>(
      owner,
      'mutation($p: ID!, $a: ID) { createStatus(input: { projectId: $p, name: "Review", category: STARTED, afterStatusId: $a }) { id position } }',
      { p: projectId, a: statuses[1].id },
    );
    expect(r.data!.createStatus.position).toBe(250);
    expect((await list()).map((s) => s.name)).toEqual([
      'To Do',
      'In Progress',
      'Review',
      'Done',
      'Cancelled',
    ]);
  });

  it('members cannot manage statuses; duplicate names are rejected', async () => {
    const q =
      'mutation($p: ID!) { createStatus(input: { projectId: $p, name: "X", category: STARTED }) { id } }';
    expect(errorCode(await h.gql(member.token, q, { p: projectId }))).toBe('FORBIDDEN');
    const dup =
      'mutation($p: ID!) { createStatus(input: { projectId: $p, name: "review", category: STARTED }) { id } }';
    expect(errorCode(await h.gql(owner, dup, { p: projectId }))).toBe('CONFLICT');
  });

  it('moves a status and renumbers when the gap runs out', async () => {
    const move =
      'mutation($id: ID!, $a: ID, $b: ID) { moveStatus(input: { id: $id, afterStatusId: $a, beforeStatusId: $b }) { position } }';
    const done = (await list()).find((s) => s.name === 'Done')!;
    await h.gql(owner, move, { id: done.id, b: statuses[0].id }); // to the front
    expect((await list())[0].name).toBe('Done');
    // Ping-pong two statuses into the same gap until a rebalance must happen.
    for (let i = 0; i < 60; i++) {
      const cur = await list();
      const mover = cur.find((s) => s.name === (i % 2 ? 'Review' : 'Cancelled'))!;
      const anchor = cur.find((s) => s.name === 'Done')!;
      const r = await h.gql(owner, move, { id: mover.id, a: anchor.id });
      expect(r.errors).toBeUndefined();
    }
    const after = await list();
    const positions = after.map((s) => s.position);
    expect(new Set(positions).size).toBe(positions.length);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(positions.every((p) => Number.isInteger(p) || p > 0)).toBe(true);
  });

  it('changing a category to COMPLETED stamps completedAt on its tasks, and back clears it', async () => {
    const prisma = await db();
    const review = (await list()).find((s) => s.name === 'Review')!;
    const owner_ = await prisma.user.findFirstOrThrow({ where: { role: 'OWNER' } });
    await prisma.task.create({
      data: { projectId, number: 1, title: 't', statusId: review.id, rank: 1000, createdById: owner_.id },
    });
    const update =
      'mutation($id: ID!, $c: StatusCategory) { updateStatus(id: $id, input: { category: $c }) { category } }';
    await h.gql(owner, update, { id: review.id, c: 'COMPLETED' });
    expect(
      (await prisma.task.findFirstOrThrow({ where: { statusId: review.id } })).completedAt,
    ).not.toBeNull();
    await h.gql(owner, update, { id: review.id, c: 'STARTED' });
    expect((await prisma.task.findFirstOrThrow({ where: { statusId: review.id } })).completedAt).toBeNull();
  });

  it('deleting a status moves its tasks (with history) to the chosen status', async () => {
    const prisma = await db();
    const cur = await list();
    const review = cur.find((s) => s.name === 'Review')!;
    const todo = cur.find((s) => s.name === 'To Do')!;
    const del = 'mutation($id: ID!, $to: ID!) { deleteStatus(id: $id, moveTasksToStatusId: $to) }';
    expect(errorCode(await h.gql(owner, del, { id: review.id, to: review.id }))).toBe('BAD_USER_INPUT');
    expect((await h.gql(owner, del, { id: review.id, to: todo.id })).data).toEqual({ deleteStatus: true });
    const task = await prisma.task.findFirstOrThrow({ where: { projectId } });
    expect(task.statusId).toBe(todo.id);
    const activity = await prisma.taskActivity.findFirstOrThrow({ where: { taskId: task.id } });
    expect(activity).toMatchObject({
      type: 'STATUS_CHANGED',
      field: 'status',
      toValue: { id: todo.id, name: 'To Do' },
    });
    expect((await list()).map((s) => s.name)).not.toContain('Review');
  });
});

describe('labels', () => {
  it('creates, soft-deletes with the actor, and restores by name', async () => {
    const create =
      'mutation($p: ID!) { createLabel(input: { projectId: $p, name: "bug", color: "#FF0000" }) { id name } }';
    const a = await h.gql<{ createLabel: { id: string } }>(member.token, create, { p: projectId });
    expect(errorCode(await h.gql(owner, create, { p: projectId }))).toBe('CONFLICT');
    const del = 'mutation($id: ID!) { deleteLabel(id: $id) }';
    expect(errorCode(await h.gql(member.token, del, { id: a.data!.createLabel.id }))).toBe('FORBIDDEN');
    await h.gql(owner, del, { id: a.data!.createLabel.id });
    const row = await (await db()).label.findUniqueOrThrow({ where: { id: a.data!.createLabel.id } });
    expect(row.deletedAt).not.toBeNull();
    expect(row.deletedById).not.toBeNull();
    const labels = await h.gql<{ project: { labels: unknown[] } }>(
      owner,
      'query($id: ID!) { project(id: $id) { labels { id } } }',
      { id: projectId },
    );
    expect(labels.data!.project.labels).toHaveLength(0);
    const b = await h.gql<{ createLabel: { id: string } }>(owner, create, { p: projectId });
    expect(b.data!.createLabel.id).toBe(a.data!.createLabel.id);
  });
});
