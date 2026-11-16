import DataLoader from 'dataloader';
import type { Label, PrismaClient, Project, TaskStatus, User } from '../generated/tenant';

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
