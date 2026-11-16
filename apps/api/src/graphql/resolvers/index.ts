import { mergeResolvers } from '@graphql-tools/merge';
import type { Resolvers } from '../__generated__/resolvers-types';
import { DateScalar, DateTimeScalar, JSONScalar } from '../scalars';
import { labelResolvers } from './label';
import { projectResolvers } from './project';
import { statusResolvers } from './status';

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
]);
