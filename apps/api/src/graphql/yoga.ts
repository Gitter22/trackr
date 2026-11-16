import path from 'node:path';
import { loadFilesSync } from '@graphql-tools/load-files';
import { mergeTypeDefs } from '@graphql-tools/merge';
import { makeExecutableSchema } from '@graphql-tools/schema';
import type { Request, Response } from 'express';
import { GraphQLError, NoSchemaIntrospectionCustomRule } from 'graphql';
import { createYoga, maskError, type Plugin } from 'graphql-yoga';
import { env } from '../config/env';
import { buildContext } from './context';
import { depthLimit } from './depth-limit';
import { resolvers } from './resolvers';

export const MAX_QUERY_DEPTH = 8;

export function buildSchema() {
  const typeDefs = mergeTypeDefs(loadFilesSync(path.join(__dirname, 'schema/*.graphql')));
  return makeExecutableSchema({ typeDefs, resolvers });
}

/** Adds extra validation rules (depth limit, and no introspection in production). */
function validationRules(): Plugin {
  const rules = [depthLimit(MAX_QUERY_DEPTH)];
  if (env().NODE_ENV === 'production') rules.push(NoSchemaIntrospectionCustomRule as never);
  return {
    onValidate({ addValidationRule }) {
      for (const rule of rules) addValidationRule(rule);
    },
  };
}

/**
 * Errors we raise on purpose keep their message and code: GraphQLErrors from
 * resolvers and ForbiddenError from the policy. Everything else is masked as
 * "Unexpected error." so internals (SQL, stack traces) never reach the client.
 */
function keepKnownErrors(error: unknown, message: string, isDev?: boolean): Error {
  if (error instanceof GraphQLError) {
    const original = error.originalError;
    if (!original || original instanceof GraphQLError) return error;
    if ('code' in original && original.code === 'FORBIDDEN') {
      return new GraphQLError(original.message, {
        nodes: error.nodes,
        path: error.path,
        extensions: { code: 'FORBIDDEN' },
      });
    }
  }
  return maskError(error, message, isDev);
}

/** Mounted after the tenant pipeline + auth, so req carries tenant, prisma and user. */
export function createGraphQLHandler() {
  return createYoga<{ req: Request; res: Response }>({
    schema: buildSchema(),
    graphqlEndpoint: '/graphql',
    context: ({ req }) => buildContext({ req }),
    plugins: [validationRules()],
    // Errors thrown as GraphQLError keep their message + code; anything else is masked.
    maskedErrors: { maskError: keepKnownErrors, isDev: env().NODE_ENV === 'development' },
    graphiql: env().NODE_ENV === 'development',
    landingPage: false,
  });
}
