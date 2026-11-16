import type { CodegenConfig } from '@graphql-codegen/cli';

/** Resolver types from the SDL. Parent types are the Prisma models (mappers). */
const config: CodegenConfig = {
  schema: 'src/graphql/schema/*.graphql',
  generates: {
    'src/graphql/__generated__/resolvers-types.ts': {
      plugins: ['typescript', 'typescript-resolvers'],
      config: {
        contextType: '../context#GraphQLContext',
        useIndexSignature: false,
        enumsAsTypes: true,
        scalars: { DateTime: 'Date', Date: 'Date', JSON: 'unknown' },
        mappers: {
          User: '../../generated/tenant#User as UserModel',
          Project: '../../generated/tenant#Project as ProjectModel',
          TaskStatus: '../../generated/tenant#TaskStatus as TaskStatusModel',
          Label: '../../generated/tenant#Label as LabelModel',
          Task: '../../generated/tenant#Task as TaskModel',
          Comment: '../../generated/tenant#Comment as CommentModel',
          TaskActivity: '../../generated/tenant#TaskActivity as TaskActivityModel',
          TaskConnection: '../models#TaskConnectionModel',
        },
      },
    },
  },
};

export default config;
