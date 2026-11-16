/**
 * localStorage scoped to one tenant: every key is prefixed "trcker:<slug>:".
 * A user can be signed in to several orgs in one browser without clashes.
 */
export interface TenantStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
  key(key: string): string;
}

export function tenantStorage(slug: string, backend: Storage = window.localStorage): TenantStorage {
  const key = (k: string) => `trcker:${slug}:${k}`;
  return {
    key,
    get: (k) => backend.getItem(key(k)),
    set: (k, v) => backend.setItem(key(k), v),
    remove: (k) => backend.removeItem(key(k)),
  };
}

export const TOKEN_KEY = 'token';
