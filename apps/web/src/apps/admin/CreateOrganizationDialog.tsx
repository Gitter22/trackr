import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { errorMessage } from '@/api/errors';
import { Alert } from '@/components/ui/alert';
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
import { APP_DOMAIN } from '@/lib/config';
import { RESERVED_SLUGS, SLUG_RE, slugify } from '@/lib/slug';
import { browserTimezone, timezones } from '@/lib/timezones';
import { useCreateOrganization, useOwners } from './api';

export const orgSchema = z.object({
  title: z.string().trim().min(1, 'Enter a name').max(100),
  slug: z
    .string()
    .regex(SLUG_RE, '3-32 lowercase letters, digits or dashes, starting with a letter')
    .refine((s) => !s.includes('--'), 'No double dashes')
    .refine((s) => !RESERVED_SLUGS.includes(s), 'This address is reserved'),
  ownerId: z.string().min(1, 'Pick an owner'),
  projectLimit: z.coerce.number<string>().int('Whole number').min(1, 'At least 1').max(1000, 'At most 1000'),
  timezone: z.string().min(1),
});
type FormIn = z.input<typeof orgSchema>;
type FormOut = z.output<typeof orgSchema>;

export function CreateOrganizationDialog() {
  const [open, setOpen] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const owners = useOwners();
  const create = useCreateOrganization();
  const zones = useMemo(timezones, []);
  const form = useForm<FormIn, unknown, FormOut>({
    resolver: zodResolver(orgSchema),
    defaultValues: { title: '', slug: '', ownerId: '', projectLimit: '10', timezone: browserTimezone() },
  });
  const { errors } = form.formState;
  const slug = form.watch('slug');

  const close = () => {
    setOpen(false);
    setSlugTouched(false);
    form.reset();
    create.reset();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> New organization
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New organization</DialogTitle>
          <DialogDescription>
            Creates a separate database for this organization and adds the owner.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          noValidate
          onSubmit={form.handleSubmit((v) =>
            create.mutate(v, {
              onSuccess: (org) => {
                if (org.status === 'ACTIVE')
                  toast.success(`${org.title} is ready at ${org.slug}.${APP_DOMAIN}`);
                else toast.error(`${org.title} could not be set up. You can retry from the list.`);
                close();
              },
            }),
          )}
        >
          {create.isError && <Alert>{errorMessage(create.error)}</Alert>}
          <FormField label="Name" htmlFor="org-title" error={errors.title?.message}>
            <Input
              id="org-title"
              aria-invalid={!!errors.title}
              {...form.register('title', {
                onChange: (e) => {
                  if (!slugTouched) form.setValue('slug', slugify(e.target.value));
                },
              })}
            />
          </FormField>
          <FormField
            label="Address (slug)"
            htmlFor="org-slug"
            error={errors.slug?.message}
            hint={slug ? `${slug}.${APP_DOMAIN}` : undefined}
          >
            <Input
              id="org-slug"
              aria-invalid={!!errors.slug}
              {...form.register('slug', { onChange: () => setSlugTouched(true) })}
            />
          </FormField>
          <FormField
            label="Owner"
            htmlFor="org-owner"
            error={errors.ownerId?.message}
            hint={owners.data?.length === 0 ? 'Create a user first on the Users page.' : undefined}
          >
            <NativeSelect id="org-owner" aria-invalid={!!errors.ownerId} {...form.register('ownerId')}>
              <option value="">Choose a user…</option>
              {owners.data?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Project limit" htmlFor="org-limit" error={errors.projectLimit?.message}>
              <Input
                id="org-limit"
                type="number"
                min={1}
                max={1000}
                aria-invalid={!!errors.projectLimit}
                {...form.register('projectLimit')}
              />
            </FormField>
            <FormField
              label="Timezone"
              htmlFor="org-tz"
              error={errors.timezone?.message}
              hint="Used for overdue dates"
            >
              <NativeSelect id="org-tz" {...form.register('timezone')}>
                {zones.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Setting up database…' : 'Create organization'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
