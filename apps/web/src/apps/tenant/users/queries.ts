import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTenantSession, type Role, type SessionUser } from '../session';

export const userKeys = { all: ['tenant-users'] as const };

export function useUsers() {
  const { api } = useTenantSession();
  return useQuery({
    queryKey: userKeys.all,
    queryFn: async () => (await api.get<{ users: SessionUser[] }>('/users')).data.users,
  });
}

export function useUserMutations() {
  const { api } = useTenantSession();
  const qc = useQueryClient();
  const onSettled = () => qc.invalidateQueries({ queryKey: userKeys.all });
  return {
    create: useMutation({
      mutationFn: async (input: { name: string; email: string; role: Exclude<Role, 'OWNER'> }) =>
        (await api.post<{ user: SessionUser }>('/users', input)).data.user,
      onSettled,
    }),
    update: useMutation({
      mutationFn: async ({
        id,
        ...patch
      }: {
        id: string;
        role?: Exclude<Role, 'OWNER'>;
        isActive?: boolean;
        name?: string;
      }) => (await api.patch<{ user: SessionUser }>(`/users/${id}`, patch)).data.user,
      onSettled,
    }),
  };
}
