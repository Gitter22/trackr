import { z } from 'zod';
import type { Prisma, StatusCategory, TaskStatus } from '../../generated/tenant';
import { evenlySpaced, placeInList } from '../../lib/fractional';
import type { Resolvers } from '../__generated__/resolvers-types';
import { authorizeProject } from '../access';
import type { GraphQLContext } from '../context';
import { badInput, conflict, notFound } from '../errors';
import { parse } from '../validate';

const STEP = 100;
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color must be #RRGGBB');
const name = z.string().trim().min(1).max(40);

async function loadStatus(ctx: GraphQLContext, id: string): Promise<TaskStatus> {
  const status = await ctx.loaders.statusById.load(id);
  if (!status) throw notFound('Status not found');
  return status;
}

/** Renumbers an ordered status list 100, 200, ... (a project has only a handful of statuses). */
async function renumber(tx: Prisma.TransactionClient, ordered: { id: string }[]): Promise<void> {
  const positions = evenlySpaced(ordered.length, STEP);
  await Promise.all(
    ordered.map((s, i) => tx.taskStatus.update({ where: { id: s.id }, data: { position: positions[i] } })),
  );
}

/** Keeps completedAt in sync when tasks enter or leave a COMPLETED status. */
async function syncCompletedAt(
  tx: Prisma.TransactionClient,
  statusId: string,
  from: StatusCategory,
  to: StatusCategory,
) {
  if (from !== 'COMPLETED' && to === 'COMPLETED') {
    await tx.task.updateMany({ where: { statusId, completedAt: null }, data: { completedAt: new Date() } });
  } else if (from === 'COMPLETED' && to !== 'COMPLETED') {
    await tx.task.updateMany({ where: { statusId }, data: { completedAt: null } });
  }
}

export const statusResolvers: Resolvers = {
  Mutation: {
    createStatus: async (_p, { input }, ctx) => {
      await authorizeProject(ctx, input.projectId, 'taskStatus', 'create');
      const data = parse(z.object({ name, color: color.nullish() }), input);
      return ctx.prisma.$transaction(async (tx) => {
        const list = await tx.taskStatus.findMany({
          where: { projectId: input.projectId },
          orderBy: { position: 'asc' },
        });
        if (list.some((s) => s.name.toLowerCase() === data.name.toLowerCase()))
          throw conflict('A status with this name exists');
        const place = placeInList(list, { afterId: input.afterStatusId }, STEP);
        if (!place) throw badInput('afterStatusId is not a status of this project');
        const created = await tx.taskStatus.create({
          data: {
            projectId: input.projectId,
            name: data.name,
            category: input.category,
            position: place.value,
            ...(data.color ? { color: data.color } : {}),
          },
        });
        if (place.rebalance) {
          const ordered = [...list];
          ordered.splice(place.index, 0, created);
          await renumber(tx, ordered);
          return tx.taskStatus.findUniqueOrThrow({ where: { id: created.id } });
        }
        return created;
      });
    },

    updateStatus: async (_p, { id, input }, ctx) => {
      const status = await loadStatus(ctx, id);
      await authorizeProject(ctx, status.projectId, 'taskStatus', 'edit');
      const data = parse(z.object({ name: name.nullish(), color: color.nullish() }), input);
      return ctx.prisma.$transaction(async (tx) => {
        if (data.name && data.name.toLowerCase() !== status.name.toLowerCase()) {
          const clash = await tx.taskStatus.findFirst({
            where: {
              projectId: status.projectId,
              name: { equals: data.name, mode: 'insensitive' },
              NOT: { id },
            },
          });
          if (clash) throw conflict('A status with this name exists');
        }
        if (input.category && input.category !== status.category) {
          await syncCompletedAt(tx, id, status.category, input.category);
        }
        return tx.taskStatus.update({
          where: { id },
          data: {
            ...(data.name ? { name: data.name } : {}),
            ...(data.color ? { color: data.color } : {}),
            ...(input.category ? { category: input.category } : {}),
          },
        });
      });
    },

    moveStatus: async (_p, { input }, ctx) => {
      const status = await loadStatus(ctx, input.id);
      await authorizeProject(ctx, status.projectId, 'taskStatus', 'reorder');
      return ctx.prisma.$transaction(async (tx) => {
        const others = await tx.taskStatus.findMany({
          where: { projectId: status.projectId, NOT: { id: status.id } },
          orderBy: { position: 'asc' },
        });
        const place = placeInList(
          others,
          { afterId: input.afterStatusId, beforeId: input.beforeStatusId },
          STEP,
        );
        if (!place) throw badInput('Neighbour status is not in this project');
        if (place.rebalance) {
          const ordered: { id: string }[] = [...others];
          ordered.splice(place.index, 0, status);
          await renumber(tx, ordered);
          return tx.taskStatus.findUniqueOrThrow({ where: { id: status.id } });
        }
        return tx.taskStatus.update({ where: { id: status.id }, data: { position: place.value } });
      });
    },

    /**
     * Moves every task in the status to `moveTasksToStatusId` (appended at the
     * bottom, order kept, history written), then deletes the status.
     */
    deleteStatus: async (_p, { id, moveTasksToStatusId }, ctx) => {
      const status = await loadStatus(ctx, id);
      await authorizeProject(ctx, status.projectId, 'taskStatus', 'delete');
      const target = await ctx.loaders.statusById.load(moveTasksToStatusId);
      if (!target || target.projectId !== status.projectId || target.id === id) {
        throw badInput('moveTasksToStatusId must be another status of the same project');
      }
      await ctx.prisma.$transaction(async (tx) => {
        const { _max } = await tx.task.aggregate({ where: { statusId: target.id }, _max: { rank: true } });
        const base = _max.rank ?? 0;
        const from = JSON.stringify({ id: status.id, name: status.name });
        const to = JSON.stringify({ id: target.id, name: target.name });
        await tx.$executeRaw`
          INSERT INTO task_activities (id, "taskId", "actorId", type, field, "fromValue", "toValue", "createdAt")
          SELECT gen_random_uuid(), t.id, ${ctx.user.id}::uuid, 'STATUS_CHANGED', 'status', ${from}::jsonb, ${to}::jsonb, now()
          FROM tasks t WHERE t."statusId" = ${id}::uuid AND t."deletedAt" IS NULL`;
        await tx.$executeRaw`
          WITH moved AS (
            SELECT id, row_number() OVER (ORDER BY rank, id) AS n FROM tasks WHERE "statusId" = ${id}::uuid
          )
          UPDATE tasks t SET "statusId" = ${target.id}::uuid, rank = ${base} + moved.n * 1000, "updatedAt" = now()
          FROM moved WHERE t.id = moved.id`;
        await syncCompletedAt(tx, target.id, status.category, target.category);
        await tx.taskStatus.delete({ where: { id } });
      });
      return true;
    },
  },
};
