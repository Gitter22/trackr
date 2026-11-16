import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { createGqlRequest, type GqlRequest } from '@/api/gql';
import { createTenantApi } from '@/api/rest';
import { TOKEN_KEY, tenantStorage, type TenantStorage } from '@/lib/storage';

export type Role = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  isActive: boolean;
}
export interface Org {
  slug: string;
  title: string;
  timezone: string;
}

interface TenantSession {
  slug: string;
  storage: TenantStorage;
  api: ReturnType<typeof createTenantApi>;
  gql: GqlRequest;
  token: string | null;
  user: SessionUser | null;
  org: Org | null;
  loading: boolean;
  signIn: (token: string) => void;
  signOut: () => void;
}

const Ctx = createContext<TenantSession | null>(null);

/**
 * Tenant session: Bearer token in slug-prefixed localStorage, user from /auth/me.
 * Any 401 (expired token, deactivated user, role change) signs the user out.
 */
export function TenantSessionProvider({ slug, children }: { slug: string; children: ReactNode }) {
  const queryClient = useQueryClient();
  const storage = useMemo(() => tenantStorage(slug), [slug]);
  const [token, setToken] = useState(() => storage.get(TOKEN_KEY));

  const signOut = useCallback(() => {
    storage.remove(TOKEN_KEY);
    setToken(null);
    queryClient.clear();
  }, [storage, queryClient]);

  const api = useMemo(() => createTenantApi(storage, signOut), [storage, signOut]);
  const gql = useMemo(() => createGqlRequest(storage, signOut), [storage, signOut]);

  const me = useQuery({
    queryKey: ['me', token],
    enabled: Boolean(token),
    queryFn: async () => (await api.get<{ user: SessionUser; org: Org }>('/auth/me')).data,
  });

  const signIn = useCallback(
    (t: string) => {
      storage.set(TOKEN_KEY, t);
      setToken(t);
    },
    [storage],
  );

  const value: TenantSession = {
    slug,
    storage,
    api,
    gql,
    token,
    user: me.data?.user ?? null,
    org: me.data?.org ?? null,
    loading: Boolean(token) && me.isPending,
    signIn,
    signOut,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTenantSession(): TenantSession {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTenantSession must be used inside TenantSessionProvider');
  return ctx;
}
