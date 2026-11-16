import { z } from 'zod';
import type { Prisma } from '../../generated/tenant';
import { assertCan } from '../../policy/policy';
import type { Resolvers } from '../__generated__/resolvers-types';
import { authorizeProject, canViewProject } from '../access';
import { badInput, conflict, notFound } from '../errors';
import { parse } from '../validate';

const DEFAULT_STATUSES: Prisma.TaskStatusCreateManyProjectInput[] = [
  { name: 'To Do', category: 'NOT_STARTED', position: 100, color: '#6B7280' },
  { name: 'In Progress', category: 'STARTED', position: 200, color: '#2563EB' },
  { name: 'Done', category: 'COMPLETED', position: 300, color: '#16A34A' },
  { name: 'Cancelled', category: 'CANCELLED', position: 400, color: '#9CA3AF' },
];

const createProjectSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(5000).nullish(),
  shortCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9]{1,5}$/, 'Short code: 2-6 letters or digits, starting with a letter'),
  memberIds: z.array(z.uuid()).max(500).nullish(),
});

const updateProjectSchema = z.object({
  title: z.string().trim().min(1).max(120).nullish(),
  description: z.string().trim().max(5000).nullish(),
});

export const projectResolvers: Resolvers = {
  Query: {
    projects: async (_p, { includeArchived }, ctx) => {
      const where: Prisma.ProjectWhereInput = includeArchived ? {} : { archivedAt: null };
      // Owners see every project; everyone else only projects they are members of.
      if (ctx.user.role !== 'OWNER') where.members = { some: { userId: ctx.user.id } };
      return ctx.prisma.project.findMany({ where, orderBy: [{ archivedAt: 'asc' }, { createdAt: 'desc' }] });
    },
    project: async (_p, { id }, ctx) => {
      const project = await ctx.loaders.projectById.load(id);
      return project && (await canViewProject(ctx, project)) ? project : null;
    },
  },

  Project: {
    createdBy: (p, _a, ctx) => ctx.loaders.userById.load(p.createdById).then((u) => u!),
    archivedBy: (p, _a, ctx) => (p.archivedById ? ctx.loaders.userById.load(p.archivedById) : null),
    members: (p, _a, ctx) => ctx.loaders.membersByProject.load(p.id),
    statuses: (p, _a, ctx) => ctx.loaders.statusesByProject.load(p.id),
    labels: (p, _a, ctx) => ctx.loaders.labelsByProject.load(p.id),
    taskCount: (p, _a, ctx) => ctx.loaders.taskCountByProject.load(p.id),
  },

  Mutation: {
    createProject: async (_p, { input }, ctx) => {
      assertCan(ctx.user, 'project', 'create');
      const data = parse(createProjectSchema, input);
      const memberIds = [...new Set(data.memberIds ?? [])];
      return ctx.prisma.$transaction(async (tx) => {
        // Lock the limit row so two concurrent creates can't both pass the check.
        const [limitRow] = await tx.$queryRaw<{ value: unknown }[]>`
          SELECT value FROM org_settings WHERE key = 'projectLimit' FOR UPDATE`;
        const limit = Number(limitRow?.value ?? Infinity);
        const active = await tx.project.count({ where: { archivedAt: null } });
        if (active >= limit)
          throw conflict(`Project limit reached (${limit}). Archive a project or ask for a higher limit.`);
        if (memberIds.length) {
          const found = await tx.user.count({ where: { id: { in: memberIds }, isActive: true } });
          if (found !== memberIds.length) throw badInput('Some members are unknown or inactive');
        }
        if (await tx.project.findUnique({ where: { shortCode: data.shortCode } })) {
          throw conflict(`Short code ${data.shortCode} is already used`);
        }
        return tx.project.create({
          data: {
            title: data.title,
            description: data.description ?? null,
            shortCode: data.shortCode,
            createdById: ctx.user.id,
            statuses: { createMany: { data: DEFAULT_STATUSES } },
            members: { createMany: { data: memberIds.map((userId) => ({ userId })) } },
          },
        });
      });
    },

    updateProject: async (_p, { id, input }, ctx) => {
      await authorizeProject(ctx, id, 'project', 'edit');
      const data = parse(updateProjectSchema, input);
      return ctx.prisma.project.update({
        where: { id },
        data: {
          ...(data.title ? { title: data.title } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
        },
      });
    },

    archiveProject: async (_p, { id }, ctx) => {
      const project = await authorizeProject(ctx, id, 'project', 'archive');
      if (project.archivedAt) return project;
      return ctx.prisma.project.update({
        where: { id },
        data: { archivedAt: new Date(), archivedById: ctx.user.id },
      });
    },

    unarchiveProject: async (_p, { id }, ctx) => {
      const project = await authorizeProject(ctx, id, 'project', 'archive');
      if (!project.archivedAt) return project;
      return ctx.prisma.$transaction(async (tx) => {
        const [limitRow] = await tx.$queryRaw<{ value: unknown }[]>`
          SELECT value FROM org_settings WHERE key = 'projectLimit' FOR UPDATE`;
        const limit = Number(limitRow?.value ?? Infinity);
        if ((await tx.project.count({ where: { archivedAt: null } })) >= limit) {
          throw conflict(`Project limit reached (${limit})`);
        }
        return tx.project.update({ where: { id }, data: { archivedAt: null, archivedById: null } });
      });
    },

    addProjectMember: async (_p, { projectId, userId }, ctx) => {
      const project = await authorizeProject(ctx, projectId, 'projectMember', 'add');
      const user = await ctx.prisma.user.findUnique({ where: { id: userId } });
      if (!user || !user.isActive) throw badInput('User not found or inactive');
      await ctx.prisma.projectMember.createMany({ data: [{ projectId, userId }], skipDuplicates: true });
      ctx.loaders.membersByProject.clear(projectId);
      return project;
    },

    removeProjectMember: async (_p, { projectId, userId }, ctx) => {
      const project = await authorizeProject(ctx, projectId, 'projectMember', 'remove');
      const { count } = await ctx.prisma.projectMember.deleteMany({ where: { projectId, userId } });
      if (!count) throw notFound('User is not a member of this project');
      ctx.loaders.membersByProject.clear(projectId);
      return project;
    },
  },
};
