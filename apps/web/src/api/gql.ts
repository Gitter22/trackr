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
      if (!token) return request;
      // Copy via Headers: request.headers can be a Headers instance, which object spread would empty
      // (dropping Content-Type and getting a 415 from the API).
      const headers = new Headers(request.headers as HeadersInit);
      headers.set('Authorization', `Bearer ${token}`);
      return { ...request, headers };
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
