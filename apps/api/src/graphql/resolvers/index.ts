import { mergeResolvers } from '@graphql-tools/merge';
import type { Resolvers } from '../__generated__/resolvers-types';
import { DateScalar, DateTimeScalar, JSONScalar } from '../scalars';
import { labelResolvers } from './label';
import { projectResolvers } from './project';
import { statusResolvers } from './status';
import { commentResolvers } from './comment';
import { taskResolvers } from './task';
import { taskMutationResolvers } from './task-mutations';

const baseResolvers: Resolvers = {
  DateTime: DateTimeScalar,
  Date: DateScalar,
  JSON: JSONScalar,
  Query: {
    viewer: (_p, _a, ctx) => ({ user: ctx.user, orgSlug: ctx.tenant.slug, timezone: ctx.tenant.timezone }),
  },
};

export const resolvers: Resolvers = mergeResolvers([
  baseResolvers,
  projectResolvers,
  statusResolvers,
  labelResolvers,
  taskResolvers,
  taskMutationResolvers,
  commentResolvers,
]);
