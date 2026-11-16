import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { disconnectControlPrisma } from '../../lib/control-prisma';
import { disconnectRedis, redis } from '../../lib/redis';
import { errorCode, tenantHarness } from '../../test/gql';
import { provisionTestTenant } from '../../test/tenants';

const h = tenantHarness('t-gql');
let owner: string;
let admin: { id: string; token: string };
let member: { id: string; token: string };
let viewer: { id: string; token: string };

const CREATE = `mutation($input: CreateProjectInput!) { createProject(input: $input) {
  id shortCode statuses { id name category position } members { id } } }`;

beforeAll(async () => {
  await redis().flushdb();
  await provisionTestTenant('t-gql', { projectLimit: 20 });
  await provisionTestTenant('t-limit', { projectLimit: 2 });
  owner = await h.ownerLogin();
  admin = await h.createUser(owner, 'admin@t-gql.test', 'ADMIN');
  member = await h.createUser(owner, 'member@t-gql.test', 'MEMBER');
  viewer = await h.createUser(owner, 'viewer@t-gql.test', 'VIEWER');
});
afterAll(async () => {
  await h.pool.clear();
  await disconnectControlPrisma();
  await disconnectRedis();
});

describe('graphql basics', () => {
  it('requires a session', async () => {
    const res = await h.http().post('/graphql').send({ query: '{ viewer { orgSlug } }' });
    expect(res.status).toBe(401);
  });

  it('returns the viewer', async () => {
    const r = await h.gql(owner, '{ viewer { orgSlug timezone user { email role } } }');
    expect(r.data).toEqual({
      viewer: { orgSlug: 't-gql', timezone: 'UTC', user: { email: 'owner@t-gql.test', role: 'OWNER' } },
    });
  });
});

describe('projects', () => {
  let projectId: string;

  it('owner creates a project with default statuses and members', async () => {
    const r = await h.gql<{
      createProject: {
        id: string;
        shortCode: string;
        statuses: { name: string; position: number }[];
        members: { id: string }[];
      };
    }>(owner, CREATE, {
      input: { title: 'Kiksasa Web', shortCode: 'kik', memberIds: [admin.id, member.id, viewer.id] },
    });
    expect(r.errors).toBeUndefined();
    const p = r.data!.createProject;
    projectId = p.id;
    expect(p.shortCode).toBe('KIK');
    expect(p.statuses.map((s) => [s.name, s.position])).toEqual([
      ['To Do', 100],
      ['In Progress', 200],
      ['Done', 300],
      ['Cancelled', 400],
    ]);
    expect(p.members).toHaveLength(3);
  });

  it('rejects a used short code and bad input', async () => {
    expect(errorCode(await h.gql(owner, CREATE, { input: { title: 'X', shortCode: 'KIK' } }))).toBe(
      'CONFLICT',
    );
    expect(errorCode(await h.gql(owner, CREATE, { input: { title: 'X', shortCode: '1' } }))).toBe(
      'BAD_USER_INPUT',
    );
  });

  it('only the owner creates projects', async () => {
    expect(errorCode(await h.gql(admin.token, CREATE, { input: { title: 'X', shortCode: 'ADM' } }))).toBe(
      'FORBIDDEN',
    );
  });

  it('non-owners only see projects they are members of', async () => {
    await h.gql(owner, CREATE, { input: { title: 'Secret', shortCode: 'SEC' } });
    const mine = await h.gql<{ projects: { shortCode: string }[] }>(
      member.token,
      '{ projects { shortCode } }',
    );
    expect(mine.data!.projects.map((p) => p.shortCode)).toEqual(['KIK']);
    const all = await h.gql<{ projects: { shortCode: string }[] }>(owner, '{ projects { shortCode } }');
    expect(all.data!.projects.map((p) => p.shortCode).sort()).toEqual(['KIK', 'SEC']);
    const secretId = (
      await h.gql<{ projects: { id: string; shortCode: string }[] }>(owner, '{ projects { id shortCode } }')
    ).data!.projects.find((p) => p.shortCode === 'SEC')!.id;
    const hidden = await h.gql(member.token, 'query($id: ID!) { project(id: $id) { id } }', { id: secretId });
    expect(hidden.data).toEqual({ project: null });
    // Mutations on a hidden project say NOT_FOUND, not FORBIDDEN.
    const r = await h.gql(
      admin.token,
      'mutation($id: ID!) { updateProject(id: $id, input: { title: "x" }) { id } }',
      { id: secretId },
    );
    expect(errorCode(r)).toBe('NOT_FOUND');
  });

  it('admins of the project manage members; members cannot', async () => {
    const add =
      'mutation($p: ID!, $u: ID!) { addProjectMember(projectId: $p, userId: $u) { members { id } } }';
    const remove =
      'mutation($p: ID!, $u: ID!) { removeProjectMember(projectId: $p, userId: $u) { members { id } } }';
    expect(errorCode(await h.gql(member.token, remove, { p: projectId, u: viewer.id }))).toBe('FORBIDDEN');
    const r = await h.gql<{ removeProjectMember: { members: { id: string }[] } }>(admin.token, remove, {
      p: projectId,
      u: viewer.id,
    });
    expect(r.data!.removeProjectMember.members.map((m) => m.id)).not.toContain(viewer.id);
    const back = await h.gql<{ addProjectMember: { members: { id: string }[] } }>(admin.token, add, {
      p: projectId,
      u: viewer.id,
    });
    expect(back.data!.addProjectMember.members.map((m) => m.id)).toContain(viewer.id);
  });

  it('archive is owner-only, records who, and freezes the project', async () => {
    const archive = 'mutation($id: ID!) { archiveProject(id: $id) { archivedAt archivedBy { email } } }';
    expect(errorCode(await h.gql(admin.token, archive, { id: projectId }))).toBe('FORBIDDEN');
    const r = await h.gql<{ archiveProject: { archivedAt: string; archivedBy: { email: string } } }>(
      owner,
      archive,
      { id: projectId },
    );
    expect(r.data!.archiveProject.archivedBy.email).toBe('owner@t-gql.test');
    const status = await h.gql(
      owner,
      'mutation($p: ID!) { createStatus(input: { projectId: $p, name: "QA", category: STARTED }) { id } }',
      { p: projectId },
    );
    expect(errorCode(status)).toBe('FORBIDDEN');
    const listed = await h.gql<{ projects: { id: string }[] }>(member.token, '{ projects { id } }');
    expect(listed.data!.projects).toHaveLength(0);
    const un = await h.gql<{ unarchiveProject: { archivedAt: string | null; archivedBy: unknown } }>(
      owner,
      'mutation($id: ID!) { unarchiveProject(id: $id) { archivedAt archivedBy { id } } }',
      { id: projectId },
    );
    expect(un.data!.unarchiveProject).toEqual({ archivedAt: null, archivedBy: null });
  });
});

describe('project limit', () => {
  const l = tenantHarness('t-limit');
  afterAll(() => l.pool.clear());

  it('stops at the limit; archiving frees a slot; unarchive is blocked when full', async () => {
    const o = await l.ownerLogin();
    const ids: string[] = [];
    for (const code of ['AA', 'BB']) {
      const r = await l.gql<{ createProject: { id: string } }>(o, CREATE, {
        input: { title: code, shortCode: code },
      });
      ids.push(r.data!.createProject.id);
    }
    expect(errorCode(await l.gql(o, CREATE, { input: { title: 'CC', shortCode: 'CC' } }))).toBe('CONFLICT');
    await l.gql(o, 'mutation($id: ID!) { archiveProject(id: $id) { id } }', { id: ids[0] });
    expect(errorCode(await l.gql(o, CREATE, { input: { title: 'CC', shortCode: 'CC' } }))).toBeUndefined();
    const un = await l.gql(o, 'mutation($id: ID!) { unarchiveProject(id: $id) { id } }', { id: ids[0] });
    expect(errorCode(un)).toBe('CONFLICT');
  });
});
