import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
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
import { Textarea } from '@/components/ui/textarea';
import { useUsers } from '../users/queries';
import { useProjectMutations } from './queries';

/** "Kiksasa Web" -> "KIK": first letters, uppercase, 2-6 chars. */
export function suggestShortCode(title: string): string {
  const letters = title
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .trim();
  const words = letters.split(/\s+/).filter(Boolean);
  const code = words.length > 1 ? words.map((w) => w[0]).join('') : (words[0] ?? '').slice(0, 3);
  return code.replace(/^[0-9]+/, '').slice(0, 6);
}

const schema = z.object({
  title: z.string().trim().min(1, 'Enter a title').max(120),
  description: z.string().max(5000),
  shortCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9]{1,5}$/, '2-6 letters or digits, starting with a letter'),
  memberIds: z.array(z.string()),
});
type Values = z.infer<typeof schema>;

export function CreateProjectDialog() {
  const [open, setOpen] = useState(false);
  const [codeTouched, setCodeTouched] = useState(false);
  const navigate = useNavigate();
  const users = useUsers();
  const { create } = useProjectMutations();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { title: '', description: '', shortCode: '', memberIds: [] },
  });
  const { errors } = form.formState;
  const close = () => {
    setOpen(false);
    setCodeTouched(false);
    form.reset();
    create.reset();
  };
  const candidates = users.data?.filter((u) => u.isActive && u.role !== 'OWNER') ?? [];

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button>
          <Plus /> New project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>
            Starts with To Do, In Progress, Done and Cancelled. You can change them later.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          noValidate
          onSubmit={form.handleSubmit((v) =>
            create.mutate(
              {
                title: v.title,
                description: v.description || null,
                shortCode: v.shortCode,
                memberIds: v.memberIds,
              },
              {
                onSuccess: ({ createProject }) => {
                  toast.success(`Project ${createProject.shortCode} created`);
                  close();
                  navigate(`/projects/${createProject.id}`);
                },
              },
            ),
          )}
        >
          {create.isError && <Alert>{errorMessage(create.error)}</Alert>}
          <FormField label="Title" htmlFor="project-title" error={errors.title?.message}>
            <Input
              id="project-title"
              aria-invalid={!!errors.title}
              {...form.register('title', {
                onChange: (e) => {
                  if (!codeTouched) form.setValue('shortCode', suggestShortCode(e.target.value));
                },
              })}
            />
          </FormField>
          <FormField
            label="Short code"
            htmlFor="project-code"
            error={errors.shortCode?.message}
            hint="Prefix for task keys, e.g. KIK-12"
          >
            <Input
              id="project-code"
              className="uppercase"
              maxLength={6}
              aria-invalid={!!errors.shortCode}
              {...form.register('shortCode', { onChange: () => setCodeTouched(true) })}
            />
          </FormField>
          <FormField label="Description" htmlFor="project-description">
            <Textarea id="project-description" rows={3} {...form.register('description')} />
          </FormField>
          <fieldset className="grid gap-1.5">
            <legend className="mb-1.5 text-sm font-medium">Members</legend>
            {candidates.length === 0 && (
              <p className="text-xs text-muted-foreground">No users yet. You can add members later.</p>
            )}
            <Controller
              control={form.control}
              name="memberIds"
              render={({ field }) => (
                <div className="grid max-h-40 gap-1 overflow-y-auto rounded-md border p-2">
                  {candidates.map((u) => (
                    <label
                      key={u.id}
                      className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted"
                    >
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked={field.value.includes(u.id)}
                        onChange={(e) =>
                          field.onChange(
                            e.target.checked
                              ? [...field.value, u.id]
                              : field.value.filter((id) => id !== u.id),
                          )
                        }
                      />
                      {u.name} <span className="text-xs text-muted-foreground">({u.role.toLowerCase()})</span>
                    </label>
                  ))}
                </div>
              )}
            />
          </fieldset>
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? 'Creating…' : 'Create project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
