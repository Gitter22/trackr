import { QueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { ClientError } from 'graphql-request';

/** Don't retry client errors (4xx / GraphQL errors); retry network blips once. */
function shouldRetry(count: number, err: unknown): boolean {
  if (isAxiosError(err) && err.response && err.response.status < 500) return false;
  if (err instanceof ClientError) return false;
  return count < 1;
}

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: shouldRetry, staleTime: 15_000, refetchOnWindowFocus: false } },
  });
