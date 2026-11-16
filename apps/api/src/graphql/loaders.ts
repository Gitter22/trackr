import DataLoader from 'dataloader';
import type {
  Comment,
  Label,
  PrismaClient,
  Project,
  Task,
  TaskActivity,
  TaskStatus,
  User,
} from '../generated/tenant';

/** Groups rows by key, returning one array per requested key (in order). */
function groupBy<T>(keys: readonly string[], rows: T[], keyOf: (row: T) => string): T[][] {
  const map = new Map<string, T[]>(keys.map((k) => [k, []]));
  for (const row of rows) map.get(keyOf(row))?.push(row);
  return keys.map((k) => map.get(k) ?? []);
}

function byId<T extends { id: string }>(keys: readonly string[], rows: T[]): (T | null)[] {
  const map = new Map(rows.map((r) => [r.id, r]));
  return keys.map((k) => map.get(k) ?? null);
}

/**
 * Created fresh for every request (see context.ts): batches within one request,
 * and the cache never outlives it, so nothing leaks between users or tenants.
 */
export function createLoaders(prisma: PrismaClient, viewerId: string) {
  return {
    userById: new DataLoader<string, User | null>(async (ids) =>
      byId(ids, await prisma.user.findMany({ where: { id: { in: [...ids] } } })),
    ),
    projectById: new DataLoader<string, Project | null>(async (ids) =>
      byId(ids, await prisma.project.findMany({ where: { id: { in: [...ids] } } })),
    ),
    statusById: new DataLoader<string, TaskStatus | null>(async (ids) =>
      byId(ids, await prisma.taskStatus.findMany({ where: { id: { in: [...ids] } } })),
    ),
    statusesByProject: new DataLoader<string, TaskStatus[]>(async (ids) =>
      groupBy(
        ids,
        await prisma.taskStatus.findMany({
          where: { projectId: { in: [...ids] } },
          orderBy: { position: 'asc' },
        }),
        (s) => s.projectId,
      ),
    ),
    labelsByProject: new DataLoader<string, Label[]>(async (ids) =>
      groupBy(
        ids,
        await prisma.label.findMany({
          where: { projectId: { in: [...ids] }, deletedAt: null },
          orderBy: { name: 'asc' },
        }),
        (l) => l.projectId,
      ),
    ),
    membersByProject: new DataLoader<string, User[]>(async (ids) => {
      const rows = await prisma.projectMember.findMany({
        where: { projectId: { in: [...ids] } },
        include: { user: true },
        orderBy: { user: { name: 'asc' } },
      });
      return groupBy(ids, rows, (m) => m.projectId).map((ms) => ms.map((m) => m.user));
    }),
    taskCountByProject: new DataLoader<string, number>(async (ids) => {
      const rows = await prisma.task.groupBy({
        by: ['projectId'],
        where: { projectId: { in: [...ids] }, deletedAt: null },
        _count: { _all: true },
      });
      const map = new Map(rows.map((r) => [r.projectId, r._count._all]));
      return ids.map((id) => map.get(id) ?? 0);
    }),
    taskById: new DataLoader<string, Task | null>(async (ids) =>
      byId(ids, await prisma.task.findMany({ where: { id: { in: [...ids] }, deletedAt: null } })),
    ),
    assigneesByTask: new DataLoader<string, User[]>(async (ids) => {
      const rows = await prisma.taskAssignee.findMany({
        where: { taskId: { in: [...ids] } },
        include: { user: true },
        orderBy: { assignedAt: 'asc' },
      });
      return groupBy(ids, rows, (r) => r.taskId).map((rs) => rs.map((r) => r.user));
    }),
    /** Soft-deleted labels are hidden from tasks (links are kept so a restore brings them back). */
    labelsByTask: new DataLoader<string, Label[]>(async (ids) => {
      const rows = await prisma.taskLabel.findMany({
        where: { taskId: { in: [...ids] }, label: { deletedAt: null } },
        include: { label: true },
        orderBy: { label: { name: 'asc' } },
      });
      return groupBy(ids, rows, (r) => r.taskId).map((rs) => rs.map((r) => r.label));
    }),
    commentCountByTask: new DataLoader<string, number>(async (ids) => {
      const rows = await prisma.comment.groupBy({
        by: ['taskId'],
        where: { taskId: { in: [...ids] }, deletedAt: null },
        _count: { _all: true },
      });
      const map = new Map(rows.map((r) => [r.taskId, r._count._all]));
      return ids.map((id) => map.get(id) ?? 0);
    }),
    /** Top-level comments, oldest first. Deleted ones are kept here; the resolver hides them unless they have replies. */
    commentsByTask: new DataLoader<string, Comment[]>(async (ids) =>
      groupBy(
        ids,
        await prisma.comment.findMany({
          where: { taskId: { in: [...ids] }, parentId: null },
          orderBy: { createdAt: 'asc' },
        }),
        (c) => c.taskId,
      ),
    ),
    repliesByComment: new DataLoader<string, Comment[]>(async (ids) =>
      groupBy(
        ids,
        await prisma.comment.findMany({
          where: { parentId: { in: [...ids] }, deletedAt: null },
          orderBy: { createdAt: 'asc' },
        }),
        (c) => c.parentId!,
      ),
    ),
    activityByTask: new DataLoader<string, TaskActivity[]>(async (ids) =>
      groupBy(
        ids,
        await prisma.taskActivity.findMany({
          where: { taskId: { in: [...ids] } },
          orderBy: { createdAt: 'desc' },
        }),
        (a) => a.taskId,
      ),
    ),
    /** Is the viewer a member of this project? One query for all projects in the request. */
    isMember: new DataLoader<string, boolean>(async (ids) => {
      const rows = await prisma.projectMember.findMany({
        where: { userId: viewerId, projectId: { in: [...ids] } },
        select: { projectId: true },
      });
      const set = new Set(rows.map((r) => r.projectId));
      return ids.map((id) => set.has(id));
    }),
  };
}

export type Loaders = ReturnType<typeof createLoaders>;
