import { describe, expect, it } from 'vitest';
import { can, assertCan, ForbiddenError, POLICY, RESOURCES, type Role } from './policy';

const active = (role: Role) => ({ role, isActive: true });
const member = { isProjectMember: true };
const outsider = { isProjectMember: false };

describe('policy map', () => {
  it('defines a rule for every role, resource and action', () => {
    for (const role of Object.keys(POLICY) as Role[]) {
      for (const [resource, actions] of Object.entries(RESOURCES)) {
        for (const action of actions) {
          const rule = (POLICY[role] as any)[resource][action];
          expect(rule, `${role}.${resource}.${action}`).toBeDefined();
        }
      }
    }
  });
});

describe('can()', () => {
  it('owner can do everything in any project, even without membership', () => {
    expect(can(active('OWNER'), 'project', 'create')).toBe(true);
    expect(can(active('OWNER'), 'task', 'delete', outsider)).toBe(true);
    expect(can(active('OWNER'), 'user', 'create')).toBe(true);
  });

  it('nobody can change the owner role or deactivate the owner', () => {
    expect(can(active('OWNER'), 'user', 'changeRole', { targetRole: 'OWNER' })).toBe(false);
    expect(can(active('OWNER'), 'user', 'activate', { targetRole: 'MEMBER' })).toBe(true);
  });

  it('admin manages assigned projects only and cannot create projects or users', () => {
    expect(can(active('ADMIN'), 'project', 'create')).toBe(false);
    expect(can(active('ADMIN'), 'user', 'create')).toBe(false);
    expect(can(active('ADMIN'), 'taskStatus', 'create', member)).toBe(true);
    expect(can(active('ADMIN'), 'taskStatus', 'create', outsider)).toBe(false);
    expect(can(active('ADMIN'), 'projectMember', 'add', member)).toBe(true);
  });

  it('member creates and moves tasks in assigned projects, cannot manage statuses', () => {
    expect(can(active('MEMBER'), 'task', 'create', member)).toBe(true);
    expect(can(active('MEMBER'), 'task', 'move', member)).toBe(true);
    expect(can(active('MEMBER'), 'task', 'create', outsider)).toBe(false);
    expect(can(active('MEMBER'), 'task', 'delete', member)).toBe(false);
    expect(can(active('MEMBER'), 'taskStatus', 'create', member)).toBe(false);
  });

  it('only the author edits a comment', () => {
    expect(can(active('MEMBER'), 'comment', 'edit', { ...member, isAuthor: true })).toBe(true);
    expect(can(active('ADMIN'), 'comment', 'edit', { ...member, isAuthor: false })).toBe(false);
  });

  it('viewer is read-only in assigned projects', () => {
    expect(can(active('VIEWER'), 'task', 'view', member)).toBe(true);
    expect(can(active('VIEWER'), 'task', 'view', outsider)).toBe(false);
    expect(can(active('VIEWER'), 'task', 'create', member)).toBe(false);
    expect(can(active('VIEWER'), 'comment', 'create', member)).toBe(false);
  });

  it('archived projects are read-only for everyone', () => {
    const archived = { ...member, projectArchived: true };
    expect(can(active('OWNER'), 'task', 'create', archived)).toBe(false);
    expect(can(active('MEMBER'), 'task', 'view', archived)).toBe(true);
  });

  it('inactive users can do nothing', () => {
    expect(can({ role: 'OWNER', isActive: false }, 'project', 'view')).toBe(false);
  });

  it('assertCan throws ForbiddenError', () => {
    expect(() => assertCan(active('VIEWER'), 'task', 'create', member)).toThrow(ForbiddenError);
  });
});
