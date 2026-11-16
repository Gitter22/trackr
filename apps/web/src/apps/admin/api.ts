import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/api/rest';

export interface Admin {
  id: string;
  email: string;
  name: string;
}
export type OrgStatus = 'PROVISIONING' | 'ACTIVE' | 'INACTIVE' | 'FAILED';
export interface OwnerUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  organizations: { id: string; slug: string; title: string; status: OrgStatus }[];
}
export interface Organization {
  id: string;
  title: string;
  slug: string;
  dbName: string;
  status: OrgStatus;
  provisionError: string | null;
  projectLimit: number;
  timezone: string;
  createdAt: string;
  owner: { id: string; name: string; email: string };
}
export interface CreateOrgInput {
  title: string;
  slug: string;
  ownerId: string;
  projectLimit: number;
  timezone: string;
}

const keys = { me: ['admin', 'me'], users: ['admin', 'users'], orgs: ['admin', 'orgs'] } as const;

/** Current super admin; null when signed out (401). */
export function useAdminMe() {
  return useQuery({
    queryKey: keys.me,
    queryFn: async () => {
      try {
        return (await adminApi.get<{ admin: Admin }>('/auth/me')).data.admin;
      } catch (err) {
        if ((err as { response?: { status?: number } }).response?.status === 401) return null;
        throw err;
      }
    },
  });
}

export function useAdminLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { email: string; password: string }) =>
      (await adminApi.post<{ admin: Admin }>('/auth/login', input)).data.admin,
    onSuccess: (admin) => qc.setQueryData(keys.me, admin),
  });
}

export function useAdminLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => adminApi.post('/auth/logout'),
    onSuccess: () => {
      qc.clear();
      qc.setQueryData(keys.me, null);
    },
  });
}

export function useOwners() {
  return useQuery({
    queryKey: keys.users,
    queryFn: async () => (await adminApi.get<{ users: OwnerUser[] }>('/users')).data.users,
  });
}

export function useCreateOwner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; email: string }) => (await adminApi.post('/users', input)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.users }),
  });
}

export function useOrganizations() {
  return useQuery({
    queryKey: keys.orgs,
    queryFn: async () =>
      (await adminApi.get<{ organizations: Organization[] }>('/organizations')).data.organizations,
  });
}

function useOrgMutation<T, R = unknown>(fn: (input: T) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: keys.orgs });
      void qc.invalidateQueries({ queryKey: keys.users });
    },
  });
}

export const useCreateOrganization = () =>
  useOrgMutation(
    async (input: CreateOrgInput) =>
      (await adminApi.post<{ organization: Organization }>('/organizations', input)).data.organization,
  );

export const useSetOrgStatus = () =>
  useOrgMutation(async ({ id, status }: { id: string; status: 'ACTIVE' | 'INACTIVE' }) =>
    adminApi.patch(`/organizations/${id}/status`, { status }),
  );

export const useRetryOrg = () =>
  useOrgMutation(async (id: string) => adminApi.post(`/organizations/${id}/retry`));
