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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCreateOwner, useOwners } from './api';

const schema = z.object({
  name: z.string().trim().min(1, 'Enter a name').max(100),
  email: z.email('Enter a valid email'),
});
type Values = z.infer<typeof schema>;

function CreateOwnerDialog() {
  const [open, setOpen] = useState(false);
  const create = useCreateOwner();
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: '', email: '' } });
  const { errors } = form.formState;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          form.reset();
          create.reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus /> New user
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New user</DialogTitle>
          <DialogDescription>
            Org owners sign in with the default owner password once their organization exists.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          noValidate
          onSubmit={form.handleSubmit((v) =>
            create.mutate(v, {
              onSuccess: () => {
                toast.success(`${v.name} added`);
                setOpen(false);
                form.reset();
              },
            }),
          )}
        >
          {create.isError && <Alert>{errorMessage(create.error)}</Alert>}
          <FormField label="Name" htmlFor="owner-name" error={errors.name?.message}>
            <Input id="owner-name" aria-invalid={!!errors.name} {...form.register('name')} />
          </FormField>
          <FormField label="Email" htmlFor="owner-email" error={errors.email?.message}>
            <Input id="owner-email" type="email" aria-invalid={!!errors.email} {...form.register('email')} />
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

export function UsersPage() {
  const users = useOwners();
  return (
    <>
      <PageHeader
        title="Users"
        description="People who can own an organization."
        actions={<CreateOwnerDialog />}
      />
      {users.isError && <Alert>{errorMessage(users.error)}</Alert>}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Organizations</TableHead>
            <TableHead>Added</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.isPending && (
            <TableRow>
              <TableCell colSpan={4} className="text-muted-foreground">
                Loading…
              </TableCell>
            </TableRow>
          )}
          {users.data?.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                No users yet. Create one to own an organization.
              </TableCell>
            </TableRow>
          )}
          {users.data?.map((u) => (
            <TableRow key={u.id}>
              <TableCell className="font-medium">{u.name}</TableCell>
              <TableCell>{u.email}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {u.organizations.length === 0 && <span className="text-muted-foreground">None</span>}
                  {u.organizations.map((o) => (
                    <Badge key={o.id} variant="secondary">
                      {o.title}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {new Date(u.createdAt).toLocaleDateString()}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
