import { z } from 'zod';
import type { Resolvers } from '../__generated__/resolvers-types';
import { authorizeProject } from '../access';
import { conflict, notFound } from '../errors';
import { parse } from '../validate';

const labelSchema = z.object({
  name: z.string().trim().min(1).max(40),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Color must be #RRGGBB')
    .nullish(),
});

export const labelResolvers: Resolvers = {
  Mutation: {
    /** Re-creating a deleted label's name restores that label (and its task links). */
    createLabel: async (_p, { input }, ctx) => {
      await authorizeProject(ctx, input.projectId, 'label', 'create');
      const data = parse(labelSchema, input);
      const existing = await ctx.prisma.label.findUnique({
        where: { projectId_name: { projectId: input.projectId, name: data.name } },
      });
      if (existing && !existing.deletedAt) throw conflict('A label with this name exists');
      if (existing) {
        return ctx.prisma.label.update({
          where: { id: existing.id },
          data: { deletedAt: null, deletedById: null, ...(data.color ? { color: data.color } : {}) },
        });
      }
      return ctx.prisma.label.create({
        data: { projectId: input.projectId, name: data.name, ...(data.color ? { color: data.color } : {}) },
      });
    },

    /** Soft delete: records who deleted it. The label disappears from tasks but links are kept for restore. */
    deleteLabel: async (_p, { id }, ctx) => {
      const label = await ctx.prisma.label.findUnique({ where: { id } });
      if (!label || label.deletedAt) throw notFound('Label not found');
      await authorizeProject(ctx, label.projectId, 'label', 'delete');
      await ctx.prisma.label.update({
        where: { id },
        data: { deletedAt: new Date(), deletedById: ctx.user.id },
      });
      return true;
    },
  },
};
