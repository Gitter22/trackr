import { z } from 'zod';
import type { Comment } from '../../generated/tenant';
import type { Resolvers } from '../__generated__/resolvers-types';
import { authorizeProject } from '../access';
import { logActivity } from '../activity';
import type { GraphQLContext } from '../context';
import { badInput, notFound } from '../errors';
import { parse } from '../validate';

const body = z.string().trim().min(1, 'Comment is empty').max(10000);

/** A comment on a live task, plus that task's projectId. */
async function loadComment(
  ctx: GraphQLContext,
  id: string,
): Promise<{ comment: Comment; projectId: string }> {
  const comment = await ctx.prisma.comment.findUnique({ where: { id } });
  const task = comment && !comment.deletedAt ? await ctx.loaders.taskById.load(comment.taskId) : null;
  if (!comment || !task) throw notFound('Comment not found');
  return { comment, projectId: task.projectId };
}

export const commentResolvers: Resolvers = {
  Mutation: {
    addComment: async (_p, { input }, ctx) => {
      const task = await ctx.loaders.taskById.load(input.taskId);
      if (!task) throw notFound('Task not found');
      await authorizeProject(ctx, task.projectId, 'comment', 'create');
      const text = parse(body, input.body);
      if (input.parentId) {
        const parent = await ctx.prisma.comment.findUnique({ where: { id: input.parentId } });
        if (!parent || parent.taskId !== task.id || parent.deletedAt)
          throw badInput('Parent comment not found on this task');
        if (parent.parentId) throw badInput('Replies are one level deep: reply to the top comment instead');
      }
      return ctx.prisma.$transaction(async (tx) => {
        const comment = await tx.comment.create({
          data: { taskId: task.id, authorId: ctx.user.id, parentId: input.parentId ?? null, body: text },
        });
        await logActivity(tx, task.id, ctx.user.id, [
          { type: 'COMMENTED', to: { commentId: comment.id, reply: Boolean(input.parentId) } },
        ]);
        return comment;
      });
    },

    editComment: async (_p, { id, body: newBody }, ctx) => {
      const { comment, projectId } = await loadComment(ctx, id);
      await authorizeProject(ctx, projectId, 'comment', 'edit', {
        isAuthor: comment.authorId === ctx.user.id,
      });
      return ctx.prisma.comment.update({
        where: { id },
        data: { body: parse(body, newBody), editedAt: new Date() },
      });
    },

    /** Soft delete with the actor. Replies stay; a deleted parent with replies shows as "deleted". */
    deleteComment: async (_p, { id }, ctx) => {
      const { comment, projectId } = await loadComment(ctx, id);
      await authorizeProject(ctx, projectId, 'comment', 'delete', {
        isAuthor: comment.authorId === ctx.user.id,
      });
      await ctx.prisma.$transaction(async (tx) => {
        await tx.comment.update({ where: { id }, data: { deletedAt: new Date(), deletedById: ctx.user.id } });
        await logActivity(tx, comment.taskId, ctx.user.id, [
          { type: 'COMMENT_DELETED', from: { commentId: id } },
        ]);
      });
      return true;
    },
  },

  Comment: {
    body: (c) => (c.deletedAt ? '' : c.body),
    isDeleted: (c) => c.deletedAt !== null,
    author: async (c, _a, ctx) => (await ctx.loaders.userById.load(c.authorId))!,
    deletedBy: (c, _a, ctx) => (c.deletedById ? ctx.loaders.userById.load(c.deletedById) : null),
    replies: (c, _a, ctx) => (c.parentId ? [] : ctx.loaders.repliesByComment.load(c.id)),
  },

  TaskActivity: {
    actor: async (a, _a, ctx) => (await ctx.loaders.userById.load(a.actorId))!,
  },
};
