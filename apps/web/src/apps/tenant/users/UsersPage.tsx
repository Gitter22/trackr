import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { errorMessage } from '@/api/errors';
import { PageHeader } from '@/components/layout/AppShell';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { permissionsFor } from '../permissions';
import { useTenantSession, type SessionUser } from '../session';
import { useUserMutations, useUsers } from './queries';

const ROLES = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'MEMBER', label: 'Member' },
  { value: 'VIEWER', label: 'Viewer' },
] as const;
type AssignableRole = (typeof ROLES)[number]['value'];

const schema = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(100),
  email: z.email('Enter a valid email'),
  role: z.enum(['ADMIN', 'MEMBER', 'VIEWER']),
});
type Values = z.infer<typeof schema>;

function CreateUserDialog() {
  const [open, setOpen] = useState(false);
  const { create } = useUserMutations();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '', role: 'MEMBER' },
  });
  const { errors } = form.formState;
  const close = () => {
    setOpen(false);
    form.reset();
    create.reset();
  };
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> New user
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New user</DialogTitle>
          <DialogDescription>
            They sign in with the default user password. Add them to projects so they can see them.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          noValidate
          onSubmit={form.handleSubmit((v) =>
            create.mutate(v, {
              onSuccess: (u) => {
                toast.success(`${u.name} added`);
                close();
              },
            }),
          )}
        >
          {create.isError && <Alert>{errorMessage(create.error)}</Alert>}
          <FormField label="Name" htmlFor="user-name" error={errors.name?.message}>
            <Input id="user-name" aria-invalid={!!errors.name} {...form.register('name')} />
          </FormField>
          <FormField label="Email" htmlFor="user-email" error={errors.email?.message}>
            <Input id="user-email" type="email" aria-invalid={!!errors.email} {...form.register('email')} />
          </FormField>
          <FormField label="Role" htmlFor="user-role">
            <NativeSelect id="user-role" {...form.register('role')}>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Creating…' : 'Create user'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const roleLabel = (r: SessionUser['role']) => r.charAt(0) + r.slice(1).toLowerCase();

function UserRow({ user, editable }: { user: SessionUser; editable: boolean }) {
  const { update } = useUserMutations();
  const onError = (err: unknown) => toast.error(errorMessage(err));
  return (
    <TableRow className={user.isActive ? undefined : 'opacity-60'}>
      <TableCell className="font-medium">{user.name}</TableCell>
      <TableCell>{user.email}</TableCell>
      <TableCell>
        {editable ? (
          <NativeSelect
            aria-label={`Role for ${user.name}`}
            className="h-8 w-32"
            value={user.role}
            disabled={update.isPending}
            onChange={(e) =>
              update.mutate({ id: user.id, role: e.target.value as AssignableRole }, { onError })
            }
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </NativeSelect>
        ) : (
          <Badge variant={user.role === 'OWNER' ? 'default' : 'secondary'}>{roleLabel(user.role)}</Badge>
        )}
      </TableCell>
      <TableCell>
        <Badge variant={user.isActive ? 'success' : 'outline'}>{user.isActive ? 'Active' : 'Inactive'}</Badge>
      </TableCell>
      <TableCell className="text-right">
        {editable && (
          <Button
            size="sm"
            variant="outline"
            disabled={update.isPending}
            onClick={() =>
              update.mutate(
                { id: user.id, isActive: !user.isActive },
                {
                  onSuccess: (u) => toast.success(`${u.name} ${u.isActive ? 'activated' : 'deactivated'}`),
                  onError,
                },
              )
            }
          >
            {user.isActive ? 'Deactivate' : 'Activate'}
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}

export function UsersPage() {
  const { user: me } = useTenantSession();
  const can = permissionsFor(me?.role);
  const users = useUsers();
  return (
    <>
      <PageHeader
        title="Users"
        description={
          can.manageUsers
            ? 'Add people, set their role, or turn off their access.'
            : 'People in this workspace.'
        }
        actions={can.manageUsers ? <CreateUserDialog /> : undefined}
      />
      {users.isError && <Alert>{errorMessage(users.error)}</Alert>}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">{can.manageUsers ? 'Actions' : ''}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.isPending && (
            <TableRow>
              <TableCell colSpan={5} className="text-muted-foreground">
                Loading…
              </TableCell>
            </TableRow>
          )}
          {users.data?.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              editable={can.manageUsers && u.role !== 'OWNER' && u.id !== me?.id}
            />
          ))}
        </TableBody>
      </Table>
    </>
  );
}
