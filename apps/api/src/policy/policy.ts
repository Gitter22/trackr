/**
 * Central RBAC policy. Every permission check in REST routes and GraphQL
 * resolvers goes through `can()`. Edit the POLICY map to change who can do what.
 *
 * A rule is:
 *   true / false        - always allowed / denied for that role
 *   a predicate name    - allowed only if the predicate holds for the target
 *                         (e.g. the user is a member of the task's project)
 */

export type Role = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

export const RESOURCES = {
  org: ['view', 'editSettings'],
  user: ['view', 'create', 'edit', 'changeRole', 'activate'],
  project: ['view', 'create', 'edit', 'archive'],
  projectMember: ['view', 'add', 'remove'],
  taskStatus: ['view', 'create', 'edit', 'reorder', 'delete'],
  label: ['view', 'create', 'delete'],
  task: ['view', 'create', 'edit', 'move', 'assign', 'delete'],
  comment: ['view', 'create', 'edit', 'delete'],
} as const;

export type Resource = keyof typeof RESOURCES;
export type Action<R extends Resource> = (typeof RESOURCES)[R][number];

/** Facts about the target, loaded by the caller (usually via DataLoaders). */
export interface PolicyTarget {
  /** Viewer is a member of the project the target belongs to. */
  isProjectMember?: boolean;
  /** Viewer wrote the comment. */
  isAuthor?: boolean;
  /** Project is archived (writes are blocked for everyone). */
  projectArchived?: boolean;
  /** Role of the user being acted on (for user management). */
  targetRole?: Role;
}

type Predicate = 'member' | 'author' | 'memberAndAuthor' | 'notOwnerTarget';
type Rule = boolean | Predicate;
type RoleRules = { [R in Resource]: { [A in Action<R>]: Rule } };

const OWNER: RoleRules = {
  org: { view: true, editSettings: true },
  user: { view: true, create: true, edit: true, changeRole: 'notOwnerTarget', activate: 'notOwnerTarget' },
  project: { view: true, create: true, edit: true, archive: true },
  projectMember: { view: true, add: true, remove: true },
  taskStatus: { view: true, create: true, edit: true, reorder: true, delete: true },
  label: { view: true, create: true, delete: true },
  task: { view: true, create: true, edit: true, move: true, assign: true, delete: true },
  comment: { view: true, create: true, edit: 'author', delete: true },
};

const ADMIN: RoleRules = {
  org: { view: true, editSettings: false },
  user: { view: true, create: false, edit: false, changeRole: false, activate: false },
  project: { view: 'member', create: false, edit: 'member', archive: false },
  projectMember: { view: 'member', add: 'member', remove: 'member' },
  taskStatus: { view: 'member', create: 'member', edit: 'member', reorder: 'member', delete: 'member' },
  label: { view: 'member', create: 'member', delete: 'member' },
  task: { view: 'member', create: 'member', edit: 'member', move: 'member', assign: 'member', delete: 'member' },
  comment: { view: 'member', create: 'member', edit: 'memberAndAuthor', delete: 'member' },
};

const MEMBER: RoleRules = {
  org: { view: true, editSettings: false },
  user: { view: true, create: false, edit: false, changeRole: false, activate: false },
  project: { view: 'member', create: false, edit: false, archive: false },
  projectMember: { view: 'member', add: false, remove: false },
  taskStatus: { view: 'member', create: false, edit: false, reorder: false, delete: false },
  label: { view: 'member', create: 'member', delete: false },
  task: { view: 'member', create: 'member', edit: 'member', move: 'member', assign: 'member', delete: false },
  comment: { view: 'member', create: 'member', edit: 'memberAndAuthor', delete: 'memberAndAuthor' },
};

const VIEWER: RoleRules = {
  org: { view: true, editSettings: false },
  user: { view: true, create: false, edit: false, changeRole: false, activate: false },
  project: { view: 'member', create: false, edit: false, archive: false },
  projectMember: { view: 'member', add: false, remove: false },
  taskStatus: { view: 'member', create: false, edit: false, reorder: false, delete: false },
  label: { view: 'member', create: false, delete: false },
  task: { view: 'member', create: false, edit: false, move: false, assign: false, delete: false },
  comment: { view: 'member', create: false, edit: false, delete: false },
};

export const POLICY: Record<Role, RoleRules> = { OWNER, ADMIN, MEMBER, VIEWER };

/** Actions that still work on archived projects. */
const READ_ACTIONS = new Set(['view']);
/** Resources that live inside a project and are frozen when it is archived. */
const PROJECT_SCOPED = new Set<Resource>(['projectMember', 'taskStatus', 'label', 'task', 'comment']);

function evalRule(rule: Rule, t: PolicyTarget): boolean {
  if (typeof rule === 'boolean') return rule;
  switch (rule) {
    case 'member':
      return t.isProjectMember === true;
    case 'memberAndAuthor':
      return t.isProjectMember === true && t.isAuthor === true;
    case 'author':
      return t.isAuthor === true;
    case 'notOwnerTarget':
      return t.targetRole !== 'OWNER';
  }
}

export interface Actor {
  role: Role;
  isActive: boolean;
}

export function can<R extends Resource>(actor: Actor, resource: R, action: Action<R>, target: PolicyTarget = {}): boolean {
  if (!actor.isActive) return false;
  if (target.projectArchived && PROJECT_SCOPED.has(resource) && !READ_ACTIONS.has(action)) return false;
  const rule = (POLICY[actor.role][resource] as Record<string, Rule>)[action];
  return evalRule(rule, target);
}

export class ForbiddenError extends Error {
  readonly code = 'FORBIDDEN';
  constructor(resource: string, action: string) {
    super(`Not allowed: ${action} ${resource}`);
  }
}

export function assertCan<R extends Resource>(actor: Actor, resource: R, action: Action<R>, target?: PolicyTarget): void {
  if (!can(actor, resource, action, target)) throw new ForbiddenError(resource, String(action));
}
