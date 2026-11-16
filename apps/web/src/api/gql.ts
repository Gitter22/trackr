import type { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { GraphQLClient, ClientError } from 'graphql-request';
import type { TenantStorage } from '@/lib/storage';
import { TOKEN_KEY } from '@/lib/storage';

export type GqlRequest = <TData, TVars extends object>(
  doc: TypedDocumentNode<TData, TVars>,
  vars?: TVars,
) => Promise<TData>;

/** Typed GraphQL requests with the tenant's Bearer token. A 401 calls onUnauthorized. */
export function createGqlRequest(storage: TenantStorage, onUnauthorized: () => void): GqlRequest {
  const client = new GraphQLClient(`${window.location.origin}/graphql`, {
    requestMiddleware: (request) => {
      const token = storage.get(TOKEN_KEY);
      return token
        ? {
            ...request,
            headers: { ...(request.headers as Record<string, string>), Authorization: `Bearer ${token}` },
          }
        : request;
    },
  });
  return async <TData, TVars extends object>(doc: TypedDocumentNode<TData, TVars>, vars?: TVars) => {
    try {
      return await client.request<TData>({ document: doc, variables: vars as never });
    } catch (err) {
      if (err instanceof ClientError && err.response.status === 401) onUnauthorized();
      throw err;
    }
  };
}
