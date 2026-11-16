import { isAxiosError } from 'axios';
import { ClientError } from 'graphql-request';

/** A readable message from an axios (REST) or graphql-request error. */
export function errorMessage(err: unknown): string {
  if (isAxiosError(err)) {
    const data = err.response?.data as
      { error?: { message?: string; details?: { fieldErrors?: Record<string, string[]> } } } | undefined;
    const fields = data?.error?.details?.fieldErrors;
    const first = fields && Object.entries(fields)[0];
    if (first) return `${first[0]}: ${first[1][0]}`;
    return data?.error?.message ?? err.message;
  }
  if (err instanceof ClientError) return err.response.errors?.[0]?.message ?? 'Request failed';
  return err instanceof Error ? err.message : 'Something went wrong';
}

/** GraphQL error code (FORBIDDEN, NOT_FOUND, ...) or REST error code. */
export function errorCode(err: unknown): string | undefined {
  if (err instanceof ClientError) return err.response.errors?.[0]?.extensions?.code as string | undefined;
  if (isAxiosError(err))
    return (err.response?.data as { error?: { code?: string } } | undefined)?.error?.code;
  return undefined;
}
