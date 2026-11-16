import type { Prisma, Task } from '../../generated/tenant';
import { todayInTimezone } from '../../lib/dates';
import type { Resolvers } from '../__generated__/resolvers-types';
import { authorizeProject, canViewProject } from '../access';
import type { GraphQLContext } from '../context';
import type { TaskConnectionModel } from '../models';
import {
  afterCursor,
  CLOSED_CATEGORIES,
  encodeCursor,
  overdueWhere,
  pageSize,
  taskWhere,
  withoutStatusFilter,
} from '../task-query';

const today = (ctx: GraphQLContext) => todayInTimezone(ctx.tenant.timezone);

/** One page in (rank, id) order. Fetches one extra row to know if there is a next page. */
async function page(
  ctx: GraphQLContext,
  where: Prisma.TaskWhereInput,
  first: number | null | undefined,
  after: string | null | undefined,
): Promise<TaskConnectionModel> {
  const take = pageSize(first);
  const rows = await ctx.prisma.task.findMany({
    where: { AND: [where, afterCursor(after)] },
    orderBy: [{ rank: 'asc' }, { id: 'asc' }],
    take: take + 1,
  });
  const nodes = rows.slice(0, take);
  for (const t of nodes) ctx.loaders.taskById.prime(t.id, t);
  const edges = nodes.map((node) => ({ cursor: encodeCursor(node), node }));
  return {
    edges,
    pageInfo: {
      hasNextPage: rows.length > take,
      hasPreviousPage: Boolean(after),
      startCursor: edges[0]?.cursor ?? null,
      endCursor: edges.at(-1)?.cursor ?? null,
    },
    where,
  };
}

/** Projects the viewer can see (owner: all), excluding archived ones. */
function visibleProjects(ctx: GraphQLContext): Prisma.ProjectWhereInput {
  return ctx.user.role === 'OWNER'
    ? { archivedAt: null }
    : { archivedAt: null, members: { some: { userId: ctx.user.id } } };
}

export async function loadVisibleTask(ctx: GraphQLContext, id: string): Promise<Task | null> {
  const task = await ctx.loaders.taskById.load(id);
  if (!task) return null;
  const project = await ctx.loaders.projectById.load(task.projectId);
  return project && (await canViewProject(ctx, project)) ? task : null;
}

export const taskResolvers: Resolvers = {
  Query: {
    tasks: async (_p, { projectId, filter, first, after }, ctx) => {
      await authorizeProject(ctx, projectId, 'task', 'view');
      return page(ctx, { AND: [{ projectId }, taskWhere(filter, today(ctx))] }, first, after);
    },

    task: (_p, { id }, ctx) => loadVisibleTask(ctx, id),

    myTasks: (_p, { filter, first, after }, ctx) =>
      page(
        ctx,
        {
          AND: [
            { assignees: { some: { userId: ctx.user.id } }, project: visibleProjects(ctx) },
            taskWhere(filter, today(ctx)),
          ],
        },
        first,
        after,
      ),

    /** Board summary. Uses the board filter except statusIds (the chart shows every column). */
    projectSummary: async (_p, { projectId, filter }, ctx) => {
      await authorizeProject(ctx, projectId, 'task', 'view');
      const where: Prisma.TaskWhereInput = {
        AND: [{ projectId }, taskWhere(withoutStatusFilter(filter), today(ctx))],
      };
      const overdue: Prisma.TaskWhereInput = { AND: [where, overdueWhere(today(ctx))] };
      const [statuses, byStatus, overdueCount, assigned, assignedOverdue, unassigned, unassignedOverdue] =
        await Promise.all([
          ctx.loaders.statusesByProject.load(projectId),
          ctx.prisma.task.groupBy({ by: ['statusId'], where, _count: { _all: true } }),
          ctx.prisma.task.count({ where: overdue }),
          ctx.prisma.taskAssignee.groupBy({ by: ['userId'], where: { task: where }, _count: { _all: true } }),
          ctx.prisma.taskAssignee.groupBy({
            by: ['userId'],
            where: { task: overdue },
            _count: { _all: true },
          }),
          ctx.prisma.task.count({ where: { AND: [where, { assignees: { none: {} } }] } }),
          ctx.prisma.task.count({ where: { AND: [overdue, { assignees: { none: {} } }] } }),
        ]);
      const countByStatus = new Map(byStatus.map((r) => [r.statusId, r._count._all]));
      const statusCounts = statuses.map((status) => ({ status, count: countByStatus.get(status.id) ?? 0 }));
      const categories = ['NOT_STARTED', 'STARTED', 'COMPLETED', 'CANCELLED'] as const;
      const overdueByUser = new Map(assignedOverdue.map((r) => [r.userId, r._count._all]));
      const users = await ctx.loaders.userById.loadMany(assigned.map((r) => r.userId));
      return {
        total: statusCounts.reduce((sum, s) => sum + s.count, 0),
        overdueCount,
        byStatus: statusCounts,
        byCategory: categories.map((category) => ({
          category,
          count: statusCounts
            .filter((s) => s.status.category === category)
            .reduce((sum, s) => sum + s.count, 0),
        })),
        byAssignee: [
          ...assigned.map((r, i) => ({
            user: users[i] instanceof Error ? null : users[i],
            count: r._count._all,
            overdue: overdueByUser.get(r.userId) ?? 0,
          })),
          ...(unassigned ? [{ user: null, count: unassigned, overdue: unassignedOverdue }] : []),
        ].sort((a, b) => b.count - a.count),
      };
    },
  },

  TaskConnection: {
    totalCount: (c, _a, ctx) => ctx.prisma.task.count({ where: c.where }),
  },

  Task: {
    key: async (t, _a, ctx) => `${(await ctx.loaders.projectById.load(t.projectId))!.shortCode}-${t.number}`,
    status: async (t, _a, ctx) => (await ctx.loaders.statusById.load(t.statusId))!,
    project: async (t, _a, ctx) => (await ctx.loaders.projectById.load(t.projectId))!,
    createdBy: async (t, _a, ctx) => (await ctx.loaders.userById.load(t.createdById))!,
    isOverdue: async (t, _a, ctx) => {
      if (!t.dueDate || t.dueDate >= today(ctx)) return false;
      const status = await ctx.loaders.statusById.load(t.statusId);
      return !CLOSED_CATEGORIES.includes(status!.category as (typeof CLOSED_CATEGORIES)[number]);
    },
    assignees: (t, _a, ctx) => ctx.loaders.assigneesByTask.load(t.id),
    labels: (t, _a, ctx) => ctx.loaders.labelsByTask.load(t.id),
    commentCount: (t, _a, ctx) => ctx.loaders.commentCountByTask.load(t.id),
    /** Deleted top-level comments only show (as "deleted") when they still have replies. */
    comments: async (t, _a, ctx) => {
      const comments = await ctx.loaders.commentsByTask.load(t.id);
      const replies = await ctx.loaders.repliesByComment.loadMany(comments.map((c) => c.id));
      return comments.filter((c, i) => !c.deletedAt || (Array.isArray(replies[i]) && replies[i].length > 0));
    },
    activity: (t, _a, ctx) => ctx.loaders.activityByTask.load(t.id),
  },
};
