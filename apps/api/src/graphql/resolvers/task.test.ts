import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaClient } from '../../generated/tenant';
import { disconnectControlPrisma } from '../../lib/control-prisma';
import { disconnectRedis, redis } from '../../lib/redis';
import { lookupTenant } from '../../tenant/tenant-lookup';
import { errorCode, tenantHarness } from '../../test/gql';
import { provisionTestTenant } from '../../test/tenants';

const h = tenantHarness('t-tasks');
let owner: string;
let member: { id: string; token: string };
let viewer: { id: string; token: string };
let outsider: { id: string; token: string };
let prisma: PrismaClient;
let projectId: string;
let st: Record<string, string>; // status name -> id

type T = { id: string; key: string; rank: number; status: { name: string } };
const CREATE = `mutation($i: CreateTaskInput!) { createTask(input: $i) { id key number rank status { name } } }`;
const MOVE = `mutation($i: MoveTaskInput!) { moveTask(input: $i) { id rank status { name } completedAt } }`;
const PAGE = `query($p: ID!, $f: TaskFilter, $first: Int, $after: String) {
  tasks(projectId: $p, filter: $f, first: $first, after: $after) {
    edges { cursor node { id key rank title } } pageInfo { hasNextPage endCursor } totalCount } }`;

async function create(token: string, input: Record<string, unknown>) {
  return h.gql<{ createTask: T }>(token, CREATE, { i: { projectId, ...input } });
}
async function column(status: string): Promise<string[]> {
  const r = await h.gql<{ tasks: { edges: { node: { title: string } }[] } }>(owner, PAGE, {
    p: projectId,
    f: { statusIds: [st[status]] },
    first: 100,
  });
  return r.data!.tasks.edges.map((e) => e.node.title);
}

beforeAll(async () => {
  await redis().flushdb();
  await provisionTestTenant('t-tasks', { projectLimit: 20 });
  prisma = h.pool.get((await lookupTenant('t-tasks'))!);
  owner = await h.ownerLogin();
  member = await h.createUser(owner, 'member@t-tasks.test', 'MEMBER');
  viewer = await h.createUser(owner, 'viewer@t-tasks.test', 'VIEWER');
  outsider = await h.createUser(owner, 'outsider@t-tasks.test', 'MEMBER');
  const r = await h.gql<{ createProject: { id: string; statuses: { id: string; name: string }[] } }>(
    owner,
    'mutation($m: [ID!]) { createProject(input: { title: "Board", shortCode: "KIK", memberIds: $m }) { id statuses { id name } } }',
    { m: [member.id, viewer.id] },
  );
  projectId = r.data!.createProject.id;
  st = Object.fromEntries(r.data!.createProject.statuses.map((s) => [s.name, s.id]));
});
afterAll(async () => {
  await h.pool.clear();
  await disconnectControlPrisma();
  await disconnectRedis();
});

describe('create', () => {
  it('numbers tasks per project and appends to the bottom of the column', async () => {
    const a = (await create(member.token, { title: 'A' })).data!.createTask;
    const b = (await create(member.token, { title: 'B' })).data!.createTask;
    expect([a.key, b.key]).toEqual(['KIK-1', 'KIK-2']);
    expect(a.status.name).toBe('To Do');
    expect(b.rank).toBe(a.rank + 1000);
  });

  it('gives unique numbers under concurrent creates', async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) => create(member.token, { title: `C${i}` })),
    );
    const numbers = results.map((r) => (r.data!.createTask as unknown as { number: number }).number);
    expect(new Set(numbers).size).toBe(8);
  });

  it('checks permissions and assignees', async () => {
    expect(errorCode(await create(viewer.token, { title: 'x' }))).toBe('FORBIDDEN');
    expect(errorCode(await create(outsider.token, { title: 'x' }))).toBe('NOT_FOUND');
    expect(errorCode(await create(owner, { title: 'x', assigneeIds: [outsider.id] }))).toBe('BAD_USER_INPUT');
    expect(
      errorCode(await create(owner, { title: 'x', statusId: '00000000-0000-0000-0000-000000000000' })),
    ).toBe('BAD_USER_INPUT');
  });
});

describe('cursor pagination', () => {
  it('walks every task exactly once, in (rank, id) order, even with equal ranks', async () => {
    for (let i = 0; i < 15; i++) await create(owner, { title: `P${i}`, statusId: st['In Progress'] });
    // Force ties: give 5 tasks the same rank.
    const ids = (await prisma.task.findMany({ where: { statusId: st['In Progress'] }, take: 5 })).map(
      (t) => t.id,
    );
    await prisma.task.updateMany({ where: { id: { in: ids } }, data: { rank: 5500 } });

    const seen: { id: string; rank: number }[] = [];
    let after: string | null = null;
    let pages = 0;
    do {
      const r: {
        data?: {
          tasks: {
            edges: { node: { id: string; rank: number } }[];
            pageInfo: { hasNextPage: boolean; endCursor: string };
            totalCount: number;
          };
        };
      } = await h.gql(owner, PAGE, { p: projectId, f: { statusIds: [st['In Progress']] }, first: 4, after });
      const t = r.data!.tasks;
      expect(t.totalCount).toBe(15);
      seen.push(...t.edges.map((e) => e.node));
      after = t.pageInfo.hasNextPage ? t.pageInfo.endCursor : null;
      pages++;
    } while (after);
    expect(pages).toBe(4);
    expect(new Set(seen.map((s) => s.id)).size).toBe(15);
    const sorted = [...seen].sort((a, b) => a.rank - b.rank || (a.id < b.id ? -1 : 1));
    expect(seen).toEqual(sorted);
  });

  it('caps page size and rejects bad cursors', async () => {
    const r = await h.gql<{ tasks: { edges: unknown[] } }>(owner, PAGE, { p: projectId, first: 1000 });
    expect(r.data!.tasks.edges.length).toBeLessThanOrEqual(100);
    expect(errorCode(await h.gql(owner, PAGE, { p: projectId, after: 'garbage' }))).toBe('BAD_USER_INPUT');
  });
});

describe('move (drag and drop)', () => {
  it('moves between columns, places between neighbours, records history and completedAt', async () => {
    const x = (await create(owner, { title: 'X', statusId: st.Done })).data!.createTask;
    const y = (await create(owner, { title: 'Y', statusId: st.Done })).data!.createTask;
    const a = (await create(owner, { title: 'Mover' })).data!.createTask;

    const r = await h.gql<{
      moveTask: { rank: number; status: { name: string }; completedAt: string | null };
    }>(owner, MOVE, {
      i: { id: a.id, statusId: st.Done, afterTaskId: x.id, beforeTaskId: y.id },
    });
    expect(r.data!.moveTask.status.name).toBe('Done');
    expect(r.data!.moveTask.rank).toBe((x.rank + y.rank) / 2);
    expect(r.data!.moveTask.completedAt).not.toBeNull();
    expect(await column('Done')).toEqual(['X', 'Mover', 'Y']);

    await h.gql(owner, MOVE, { i: { id: a.id, statusId: st.Done, beforeTaskId: x.id } }); // to top
    expect(await column('Done')).toEqual(['Mover', 'X', 'Y']);

    const back = await h.gql<{ moveTask: { completedAt: string | null } }>(owner, MOVE, {
      i: { id: a.id, statusId: st['To Do'] },
    });
    expect(back.data!.moveTask.completedAt).toBeNull();

    const history = await prisma.taskActivity.findMany({
      where: { taskId: a.id, type: 'STATUS_CHANGED' },
      orderBy: { createdAt: 'asc' },
    });
    expect(
      history.map((h) => [(h.fromValue as { name: string }).name, (h.toValue as { name: string }).name]),
    ).toEqual([
      ['To Do', 'Done'],
      ['Done', 'To Do'],
    ]);
  });

  it('renumbers the column when the gap between two cards runs out', async () => {
    const l = (await create(owner, { title: 'L', statusId: st.Cancelled })).data!.createTask;
    const r = (await create(owner, { title: 'R', statusId: st.Cancelled })).data!.createTask;
    const m1 = (await create(owner, { title: 'M1', statusId: st.Cancelled })).data!.createTask;
    const m2 = (await create(owner, { title: 'M2', statusId: st.Cancelled })).data!.createTask;
    // Keep dropping alternating cards right after L until the gap is gone.
    for (let i = 0; i < 60; i++) {
      const mover = i % 2 ? m1 : m2;
      const res = await h.gql(owner, MOVE, {
        i: { id: mover.id, statusId: st.Cancelled, afterTaskId: l.id },
      });
      expect(res.errors).toBeUndefined();
    }
    const order = await column('Cancelled');
    expect(order[0]).toBe('L');
    expect(order.at(-1)).toBe('R');
    const ranks = (
      await prisma.task.findMany({ where: { statusId: st.Cancelled }, orderBy: { rank: 'asc' } })
    ).map((t) => t.rank);
    expect(new Set(ranks).size).toBe(ranks.length);
    expect(r.id).toBeDefined();
  });

  it('rejects anchors from another column and viewers', async () => {
    const a = (await create(owner, { title: 'Z' })).data!.createTask;
    const other = (await create(owner, { title: 'Other', statusId: st.Done })).data!.createTask;
    expect(
      errorCode(
        await h.gql(owner, MOVE, { i: { id: a.id, statusId: st['In Progress'], afterTaskId: other.id } }),
      ),
    ).toBe('BAD_USER_INPUT');
    expect(errorCode(await h.gql(viewer.token, MOVE, { i: { id: a.id, statusId: st.Done } }))).toBe(
      'FORBIDDEN',
    );
  });
});

describe('update, filters, summary', () => {
  let taskId: string;

  it('writes one history entry per changed field', async () => {
    const label = await h.gql<{ createLabel: { id: string } }>(
      owner,
      'mutation($p: ID!) { createLabel(input: { projectId: $p, name: "bug" }) { id } }',
      { p: projectId },
    );
    taskId = (await create(owner, { title: 'Filter me' })).data!.createTask.id;
    const r = await h.gql(
      member.token,
      `mutation($id: ID!, $i: UpdateTaskInput!) { updateTask(id: $id, input: $i) {
      title priority dueDate isOverdue assignees { id } labels { name } activity { type field fromValue toValue actor { email } } } }`,
      {
        id: taskId,
        i: {
          title: 'Filter me!',
          priority: 'HIGH',
          dueDate: '2020-01-01',
          assigneeIds: [member.id],
          labelIds: [label.data!.createLabel.id],
        },
      },
    );
    expect(r.errors).toBeUndefined();
    const t = r.data!.updateTask as {
      isOverdue: boolean;
      activity: { type: string; field: string; actor: { email: string } }[];
    };
    expect(t.isOverdue).toBe(true);
    expect(t.activity.map((a) => `${a.type}:${a.field ?? ''}`).sort()).toEqual(
      [
        'ASSIGNEE_ADDED:assignees',
        'CREATED:',
        'LABEL_ADDED:labels',
        'UPDATED:dueDate',
        'UPDATED:priority',
        'UPDATED:title',
      ].sort(),
    );
    expect(t.activity.every((a) => a.actor.email)).toBe(true);
  });

  it('filters by priority, assignee, overdue, due range and key search', async () => {
    const titles = async (f: Record<string, unknown>) =>
      (
        await h.gql<{ tasks: { edges: { node: { title: string } }[] } }>(owner, PAGE, {
          p: projectId,
          f,
          first: 100,
        })
      ).data!.tasks.edges.map((e) => e.node.title);
    expect(await titles({ priorities: ['HIGH'] })).toEqual(['Filter me!']);
    expect(await titles({ assigneeIds: [member.id] })).toEqual(['Filter me!']);
    expect(await titles({ overdue: true })).toEqual(['Filter me!']);
    expect(await titles({ due: { from: '2019-12-31', to: '2020-01-02' } })).toEqual(['Filter me!']);
    expect(await titles({ due: { from: '2020-01-02' } })).toEqual([]);
    expect(await titles({ search: 'KIK-1' })).toEqual(['A']);
    expect(await titles({ search: 'filter' })).toEqual(['Filter me!']);
  });

  it('summarises counts by status, category, assignee and overdue', async () => {
    const r = await h.gql<{
      projectSummary: {
        total: number;
        overdueCount: number;
        byStatus: { status: { name: string }; count: number }[];
        byCategory: { category: string; count: number }[];
        byAssignee: { user: { email: string } | null; count: number; overdue: number }[];
      };
    }>(
      owner,
      `query($p: ID!) { projectSummary(projectId: $p) { total overdueCount
        byStatus { status { name } count } byCategory { category count } byAssignee { user { email } count overdue } } }`,
      { p: projectId },
    );
    const s = r.data!.projectSummary;
    const total = await prisma.task.count({ where: { projectId, deletedAt: null } });
    expect(s.total).toBe(total);
    expect(s.byStatus.reduce((n, x) => n + x.count, 0)).toBe(total);
    expect(s.byCategory.reduce((n, x) => n + x.count, 0)).toBe(total);
    expect(s.overdueCount).toBe(1);
    expect(s.byAssignee.find((a) => a.user?.email === 'member@t-tasks.test')).toEqual({
      user: { email: 'member@t-tasks.test' },
      count: 1,
      overdue: 1,
    });
    expect(s.byAssignee.find((a) => a.user === null)!.count).toBe(total - 1);
  });

  it('myTasks lists my tasks across visible projects', async () => {
    const r = await h.gql<{
      myTasks: { edges: { node: { title: string; project: { shortCode: string } } }[] };
    }>(
      member.token,
      '{ myTasks(filter: { overdue: true }) { edges { node { title project { shortCode } } } } }',
    );
    expect(r.data!.myTasks.edges.map((e) => [e.node.title, e.node.project.shortCode])).toEqual([
      ['Filter me!', 'KIK'],
    ]);
    const none = await h.gql<{ myTasks: { edges: unknown[] } }>(
      outsider.token,
      '{ myTasks { edges { node { id } } } }',
    );
    expect(none.data!.myTasks.edges).toEqual([]);
  });

  it('soft-deletes with the actor; members cannot delete', async () => {
    const del = 'mutation($id: ID!) { deleteTask(id: $id) }';
    expect(errorCode(await h.gql(member.token, del, { id: taskId }))).toBe('FORBIDDEN');
    expect((await h.gql(owner, del, { id: taskId })).data).toEqual({ deleteTask: true });
    const row = await prisma.task.findUniqueOrThrow({ where: { id: taskId } });
    expect(row.deletedById).not.toBeNull();
    expect((await h.gql(owner, 'query($id: ID!) { task(id: $id) { id } }', { id: taskId })).data).toEqual({
      task: null,
    });
    expect(await prisma.taskActivity.count({ where: { taskId, type: 'DELETED' } })).toBe(1);
  });
});

describe('comments', () => {
  it('adds comments and one-level replies, edits, and soft-deletes', async () => {
    const taskId = (await create(owner, { title: 'Discuss' })).data!.createTask.id;
    const add = 'mutation($i: AddCommentInput!) { addComment(input: $i) { id } }';
    const c1 = (
      await h.gql<{ addComment: { id: string } }>(member.token, add, { i: { taskId, body: 'First' } })
    ).data!.addComment.id;
    const r1 = (
      await h.gql<{ addComment: { id: string } }>(owner, add, { i: { taskId, body: 'Reply', parentId: c1 } })
    ).data!.addComment.id;
    expect(errorCode(await h.gql(owner, add, { i: { taskId, body: 'Nested', parentId: r1 } }))).toBe(
      'BAD_USER_INPUT',
    );
    expect(errorCode(await h.gql(viewer.token, add, { i: { taskId, body: 'hi' } }))).toBe('FORBIDDEN');
    expect(errorCode(await h.gql(member.token, add, { i: { taskId, body: '   ' } }))).toBe('BAD_USER_INPUT');

    const edit = 'mutation($id: ID!, $b: String!) { editComment(id: $id, body: $b) { body editedAt } }';
    expect(errorCode(await h.gql(owner, edit, { id: c1, b: 'hijack' }))).toBe('FORBIDDEN');
    expect(
      (await h.gql<{ editComment: { body: string } }>(member.token, edit, { id: c1, b: 'First!' })).data!
        .editComment.body,
    ).toBe('First!');

    await h.gql(member.token, 'mutation($id: ID!) { deleteComment(id: $id) }', { id: c1 });
    const t = await h.gql<{
      task: {
        commentCount: number;
        comments: {
          body: string;
          isDeleted: boolean;
          deletedBy: { email: string };
          replies: { body: string }[];
        }[];
      };
    }>(
      owner,
      'query($id: ID!) { task(id: $id) { commentCount comments { body isDeleted deletedBy { email } replies { body } } } }',
      { id: taskId },
    );
    expect(t.data!.task.commentCount).toBe(1);
    expect(t.data!.task.comments).toEqual([
      {
        body: '',
        isDeleted: true,
        deletedBy: { email: 'member@t-tasks.test' },
        replies: [{ body: 'Reply' }],
      },
    ]);
    expect(
      await prisma.taskActivity.count({ where: { taskId, type: { in: ['COMMENTED', 'COMMENT_DELETED'] } } }),
    ).toBe(3);
  });
});

describe('performance', () => {
  it('board query: same SQL count for 5 and 40 cards (no N+1)', async () => {
    const BOARD = `query($p: ID!, $s: ID!) { tasks(projectId: $p, filter: { statusIds: [$s] }, first: 100) { edges { node {
      key title priority isOverdue status { name } createdBy { name } assignees { name } labels { name } commentCount } } } }`;
    // Use a fresh column so only the card count changes between the two runs.
    const qa = await h.gql<{ createStatus: { id: string } }>(
      owner,
      'mutation($p: ID!) { createStatus(input: { projectId: $p, name: "QA", category: STARTED }) { id } }',
      { p: projectId },
    );
    st.QA = qa.data!.createStatus.id;
    for (let i = 0; i < 5; i++)
      await create(owner, { title: `q${i}`, statusId: st.QA, assigneeIds: [member.id] });
    h.counter.queries = 0;
    await h.gql(owner, BOARD, { p: projectId, s: st.QA });
    const small = h.counter.queries;
    for (let i = 0; i < 35; i++)
      await create(owner, { title: `q${i + 5}`, statusId: st.QA, assigneeIds: [member.id] });
    h.counter.queries = 0;
    await h.gql(owner, BOARD, { p: projectId, s: st.QA });
    expect(h.counter.queries).toBe(small);
  });

  it('column and project pages use the (statusId|projectId, rank, id) indexes', async () => {
    await prisma.$executeRawUnsafe(`
      INSERT INTO tasks (id, "projectId", number, title, priority, "statusId", rank, "createdById", "updatedAt")
      SELECT gen_random_uuid(), '${projectId}', 10000 + g, 'bulk ' || g, 'MEDIUM',
             (ARRAY['${st['To Do']}', '${st['In Progress']}', '${st.Done}', '${st.Cancelled}'])[1 + g % 4]::uuid,
             g * 10, (SELECT id FROM users WHERE role = 'OWNER'), now()
      FROM generate_series(1, 20000) g`);
    await prisma.$executeRawUnsafe('ANALYZE tasks');
    const plan = async (sql: string) =>
      (await prisma.$queryRawUnsafe<{ 'QUERY PLAN': string }[]>(`EXPLAIN ${sql}`))
        .map((r) => r['QUERY PLAN'])
        .join('\n');
    const columnPlan =
      await plan(`SELECT * FROM tasks WHERE "statusId" = '${st['In Progress']}' AND "deletedAt" IS NULL
      AND (rank > 5000 OR (rank = 5000 AND id > '00000000-0000-0000-0000-000000000000')) ORDER BY rank, id LIMIT 51`);
    expect(columnPlan).toContain('tasks_statusId_rank_id_idx');
    const projectPlan = await plan(
      `SELECT * FROM tasks WHERE "projectId" = '${projectId}' AND "deletedAt" IS NULL ORDER BY rank, id LIMIT 51`,
    );
    expect(projectPlan).toContain('tasks_projectId_rank_id_idx');
  });
});
