import { afterEach, describe, expect, it, vi } from 'vitest';
import { parse } from 'graphql';
import { tenantStorage, TOKEN_KEY } from '@/lib/storage';
import { createGqlRequest } from './gql';

afterEach(() => vi.restoreAllMocks());

describe('createGqlRequest', () => {
  it('sends JSON with the tenant Bearer token', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ data: { viewer: { orgSlug: 'kik' } } }), {
        headers: { 'content-type': 'application/json' },
      }),
    );
    const storage = tenantStorage('kik');
    storage.set(TOKEN_KEY, 'tok');
    const request = createGqlRequest(storage, () => {});
    const data = await request(parse('query Viewer { viewer { orgSlug } }') as never);
    expect(data).toEqual({ viewer: { orgSlug: 'kik' } });
    const headers = new Headers(fetchMock.mock.calls[0][1]!.headers);
    expect(headers.get('authorization')).toBe('Bearer tok');
    expect(headers.get('content-type')).toMatch(/application\/json/);
  });
});
