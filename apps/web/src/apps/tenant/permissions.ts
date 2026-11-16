import type { Role } from './session';

/**
 * What the UI shows for each role. This mirrors the API policy
 * (apps/api/src/policy/policy.ts) for hiding buttons only; the API enforces it.
 * Admin/member rights apply inside projects they belong to (the API checks that).
 */
export function permissionsFor(role: Role | undefined) {
  const owner = role === 'OWNER';
  const admin = role === 'ADMIN';
  const member = role === 'MEMBER';
  return {
    manageUsers: owner,
    createProject: owner,
    archiveProject: owner,
    editProject: owner || admin,
    manageMembers: owner || admin,
    manageStatuses: owner || admin,
    deleteLabel: owner || admin,
    createTask: owner || admin || member,
    editTask: owner || admin || member,
    deleteTask: owner || admin,
    comment: owner || admin || member,
  };
}

export type Permissions = ReturnType<typeof permissionsFor>;
