import { z } from 'zod';
import type { Prisma, StatusCategory, Task, TaskStatus } from '../../generated/tenant';
import { between, needsRebalance } from '../../lib/fractional';
import type { Resolvers } from '../__generated__/resolvers-types';
import { authorizeProject } from '../access';
import { day, logActivity, ref, type ActivityEntry } from '../activity';
import type { GraphQLContext } from '../context';
import { badInput, notFound } from '../errors';
import { parse } from '../validate';

const RANK_STEP = 1000;

const ids = z.array(z.uuid()).max(50);
const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(20000).nullish(),
  assigneeIds: ids.nullish(),
  labelIds: ids.nullish(),
});
const updateSchema = z.object({
  title: z.string().trim().min(1).max(200).nullish(),
  description: z.string().max(20000).nullish(),
  assigneeIds: ids.nullish(),
  labelIds: ids.nullish(),
});

async function loadTask(ctx: GraphQLContext, id: string): Promise<Task> {
  const task = await ctx.loaders.taskById.load(id);
  if (!task) throw notFound('Task not found');
  return task;
}

async function statusOf(ctx: GraphQLContext, projectId: string, statusId: string): Promise<TaskStatus> {
  const status = await ctx.loaders.statusById.load(statusId);
  if (!status || status.projectId !== projectId) throw badInput('Status is not part of this project');
  return status;
}

/** Assignees must be active and able to see the project (members, or the owner). */
async function checkAssignees(tx: Prisma.TransactionClient, projectId: string, userIds: string[]) {
  if (!userIds.length) return new Map<string, { id: string; name: string }>();
  const users = await tx.user.findMany({
    where: {
      id: { in: userIds },
      isActive: true,
      OR: [{ role: 'OWNER' }, { memberships: { some: { projectId } } }],
    },
    select: { id: true, name: true },
  });
  if (users.length !== userIds.length) throw badInput('Assignees must be active members of the project');
  return new Map(users.map((u) => [u.id, u]));
}

async function checkLabels(tx: Prisma.TransactionClient, projectId: string, labelIds: string[]) {
  if (!labelIds.length) return new Map<string, { id: string; name: string }>();
  const labels = await tx.label.findMany({
    where: { id: { in: labelIds }, projectId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (labels.length !== labelIds.length) throw badInput('Labels must belong to this project');
  return new Map(labels.map((l) => [l.id, l]));
}

const completedAtFor = (category: StatusCategory, current: Date | null) =>
  category === 'COMPLETED' ? (current ?? new Date()) : null;

/** Serialises rank changes within one column, so concurrent drops and renumbers can't interleave. */
async function lockColumn(tx: Prisma.TransactionClient, statusId: string) {
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${statusId}))`;
}

/** Renumbers a column 1000, 2000, ... keeping its order (except the task being moved). */
async function renumberColumn(tx: Prisma.TransactionClient, statusId: string, excludeId: string) {
  await tx.$executeRaw`
    WITH o AS (
      SELECT id, row_number() OVER (ORDER BY rank, id) AS n
      FROM tasks WHERE "statusId" = ${statusId}::uuid AND id <> ${excludeId}::uuid
    )
    UPDATE tasks t SET rank = o.n * ${RANK_STEP} FROM o WHERE t.id = o.id`;
}

/** Neighbours of the drop position in the target column, read from the DB (not trusted from the client). */
async function neighbours(
  tx: Prisma.TransactionClient,
  statusId: string,
  movingId: string,
  anchor: { afterTaskId?: string | null; beforeTaskId?: string | null },
) {
  const column: Prisma.TaskWhereInput = { statusId, deletedAt: null, id: { not: movingId } };
  if (anchor.afterTaskId) {
    const prev = await tx.task.findFirst({ where: { ...column, AND: [{ id: anchor.afterTaskId }] } });
    if (!prev) throw badInput('afterTaskId is not in the target column');
    const next = await tx.task.findFirst({
      where: { ...column, OR: [{ rank: { gt: prev.rank } }, { rank: prev.rank, id: { gt: prev.id } }] },
      orderBy: [{ rank: 'asc' }, { id: 'asc' }],
    });
    return { prev, next };
  }
  if (anchor.beforeTaskId) {
    const next = await tx.task.findFirst({ where: { ...column, AND: [{ id: anchor.beforeTaskId }] } });
    if (!next) throw badInput('beforeTaskId is not in the target column');
    const prev = await tx.task.findFirst({
      where: { ...column, OR: [{ rank: { lt: next.rank } }, { rank: next.rank, id: { lt: next.id } }] },
      orderBy: [{ rank: 'desc' }, { id: 'desc' }],
    });
    return { prev, next };
  }
  const prev = await tx.task.findFirst({ where: column, orderBy: [{ rank: 'desc' }, { id: 'desc' }] });
  return { prev, next: null };
}

export const taskMutationResolvers: Resolvers = {
  Mutation: {
    createTask: async (_p, { input }, ctx) => {
      await authorizeProject(ctx, input.projectId, 'task', 'create');
      const data = parse(createSchema, input);
      const assigneeIds = [...new Set(data.assigneeIds ?? [])];
      const labelIds = [...new Set(data.labelIds ?? [])];
      if (assigneeIds.length) await authorizeProject(ctx, input.projectId, 'task', 'assign');
      const status = input.statusId
        ? await statusOf(ctx, input.projectId, input.statusId)
        : (await ctx.loaders.statusesByProject.load(input.projectId))[0];
      if (!status) throw badInput('Project has no statuses');

      return ctx.prisma.$transaction(async (tx) => {
        const assignees = await checkAssignees(tx, input.projectId, assigneeIds);
        const labels = await checkLabels(tx, input.projectId, labelIds);
        // Atomic per-project number (row lock), so two creates never share KIK-12.
        const [{ taskSeq }] = await tx.$queryRaw<{ taskSeq: number }[]>`
          UPDATE projects SET "taskSeq" = "taskSeq" + 1 WHERE id = ${input.projectId}::uuid RETURNING "taskSeq"`;
        await lockColumn(tx, status.id);
        const { _max } = await tx.task.aggregate({ where: { statusId: status.id }, _max: { rank: true } });
        const task = await tx.task.create({
          data: {
            projectId: input.projectId,
            number: taskSeq,
            title: data.title,
            description: data.description ?? null,
            priority: input.priority ?? 'MEDIUM',
            statusId: status.id,
            rank: (_max.rank ?? 0) + RANK_STEP,
            dueDate: input.dueDate ?? null,
            completedAt: completedAtFor(status.category, null),
            createdById: ctx.user.id,
            assignees: { createMany: { data: assigneeIds.map((userId) => ({ userId })) } },
            labels: { createMany: { data: labelIds.map((labelId) => ({ labelId })) } },
          },
        });
        await logActivity(tx, task.id, ctx.user.id, [
          { type: 'CREATED', to: { title: task.title, status: ref(status) } },
          ...assigneeIds.map((id) => ({
            type: 'ASSIGNEE_ADDED' as const,
            field: 'assignees',
            to: assignees.get(id),
          })),
          ...labelIds.map((id) => ({ type: 'LABEL_ADDED' as const, field: 'labels', to: labels.get(id) })),
        ]);
        return task;
      });
    },

    updateTask: async (_p, { id, input }, ctx) => {
      const task = await loadTask(ctx, id);
      await authorizeProject(ctx, task.projectId, 'task', 'edit');
      const data = parse(updateSchema, input);
      if (data.assigneeIds) await authorizeProject(ctx, task.projectId, 'task', 'assign');

      return ctx.prisma.$transaction(async (tx) => {
        const entries: ActivityEntry[] = [];
        const patch: Prisma.TaskUncheckedUpdateInput = {};
        const field = <K extends 'title' | 'description' | 'priority'>(
          k: K,
          v: Task[K] | null | undefined,
        ) => {
          if (v === undefined || (v === null && k !== 'description') || v === task[k]) return;
          patch[k] = v as never;
          entries.push({ type: 'UPDATED', field: k, from: task[k], to: v });
        };
        field('title', data.title);
        field('description', data.description);
        field('priority', input.priority);
        if (input.dueDate !== undefined && day(input.dueDate) !== day(task.dueDate)) {
          patch.dueDate = input.dueDate;
          entries.push({
            type: 'UPDATED',
            field: 'dueDate',
            from: day(task.dueDate),
            to: day(input.dueDate),
          });
        }

        if (data.assigneeIds) {
          const next = new Set(data.assigneeIds);
          const current = await tx.taskAssignee.findMany({ where: { taskId: id }, include: { user: true } });
          const currentIds = new Set(current.map((a) => a.userId));
          const added = [...next].filter((u) => !currentIds.has(u));
          const removed = current.filter((a) => !next.has(a.userId));
          const users = await checkAssignees(tx, task.projectId, added);
          await tx.taskAssignee.deleteMany({
            where: { taskId: id, userId: { in: removed.map((r) => r.userId) } },
          });
          await tx.taskAssignee.createMany({ data: added.map((userId) => ({ taskId: id, userId })) });
          entries.push(
            ...added.map((u) => ({ type: 'ASSIGNEE_ADDED' as const, field: 'assignees', to: users.get(u) })),
            ...removed.map((r) => ({
              type: 'ASSIGNEE_REMOVED' as const,
              field: 'assignees',
              from: ref(r.user),
            })),
          );
        }

        if (data.labelIds) {
          const next = new Set(data.labelIds);
          const current = await tx.taskLabel.findMany({ where: { taskId: id }, include: { label: true } });
          const currentIds = new Set(current.map((l) => l.labelId));
          const added = [...next].filter((l) => !currentIds.has(l));
          const removed = current.filter((l) => !next.has(l.labelId));
          const labels = await checkLabels(tx, task.projectId, added);
          await tx.taskLabel.deleteMany({
            where: { taskId: id, labelId: { in: removed.map((r) => r.labelId) } },
          });
          await tx.taskLabel.createMany({ data: added.map((labelId) => ({ taskId: id, labelId })) });
          entries.push(
            ...added.map((l) => ({ type: 'LABEL_ADDED' as const, field: 'labels', to: labels.get(l) })),
            ...removed.map((r) => ({ type: 'LABEL_REMOVED' as const, field: 'labels', from: ref(r.label) })),
          );
        }

        const updated =
          Object.keys(patch).length || entries.length
            ? await tx.task.update({ where: { id }, data: { ...patch, updatedAt: new Date() } })
            : task;
        await logActivity(tx, id, ctx.user.id, entries);
        return updated;
      });
    },

    /** Drag and drop: new column plus the cards it lands between. */
    moveTask: async (_p, { input }, ctx) => {
      const task = await loadTask(ctx, input.id);
      await authorizeProject(ctx, task.projectId, 'task', 'move');
      const target = await statusOf(ctx, task.projectId, input.statusId);

      return ctx.prisma.$transaction(async (tx) => {
        await lockColumn(tx, target.id);
        let { prev, next } = await neighbours(tx, target.id, task.id, input);
        let rank = between(prev?.rank, next?.rank, RANK_STEP);
        if (needsRebalance(rank, prev?.rank, next?.rank)) {
          await renumberColumn(tx, target.id, task.id);
          ({ prev, next } = await neighbours(tx, target.id, task.id, input));
          rank = between(prev?.rank, next?.rank, RANK_STEP);
        }
        const updated = await tx.task.update({
          where: { id: task.id },
          data: { statusId: target.id, rank, completedAt: completedAtFor(target.category, task.completedAt) },
        });
        if (target.id !== task.statusId) {
          const from = (await ctx.loaders.statusById.load(task.statusId))!;
          await logActivity(tx, task.id, ctx.user.id, [
            { type: 'STATUS_CHANGED', field: 'status', from: ref(from), to: ref(target) },
          ]);
        }
        return updated;
      });
    },

    /** Soft delete: keeps the row and records who deleted it. */
    deleteTask: async (_p, { id }, ctx) => {
      const task = await loadTask(ctx, id);
      await authorizeProject(ctx, task.projectId, 'task', 'delete');
      await ctx.prisma.$transaction(async (tx) => {
        await tx.task.update({ where: { id }, data: { deletedAt: new Date(), deletedById: ctx.user.id } });
        await logActivity(tx, id, ctx.user.id, [{ type: 'DELETED', from: { title: task.title } }]);
      });
      return true;
    },
  },
};
