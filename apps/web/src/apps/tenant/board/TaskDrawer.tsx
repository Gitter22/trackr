import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/api/errors';
import type { Priority, ProjectQuery } from '@/api/generated/graphql';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { permissionsFor } from '../permissions';
import { useTenantSession } from '../session';
import { describeActivity } from './activity';
import { Comments } from './Comments';
import { useTask, useTaskMutations } from './queries';
import { initials } from './TaskCard';

type Project = NonNullable<ProjectQuery['project']>;

/** Text that saves on blur (and Enter for single-line). */
function InlineText({
  value,
  onSave,
  multiline,
  label,
  disabled,
  className,
}: {
  value: string;
  onSave: (v: string) => void;
  multiline?: boolean;
  label: string;
  disabled: boolean;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [last, setLast] = useState(value);
  if (value !== last) {
    setLast(value);
    setDraft(value);
  }
  const commit = () => draft !== value && onSave(draft);
  return multiline ? (
    <Textarea
      aria-label={label}
      rows={4}
      value={draft}
      disabled={disabled}
      placeholder="Add a description…"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      className={className}
    />
  ) : (
    <Input
      aria-label={label}
      value={draft}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => (draft.trim() ? commit() : setDraft(value))}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      className={className}
    />
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] items-start gap-2 py-1.5">
      <span className="pt-2 text-xs font-medium text-muted-foreground">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function ToggleChips<T extends { id: string; name: string; color?: string }>({
  items,
  selected,
  onToggle,
  disabled,
  empty,
}: {
  items: T[];
  selected: string[];
  onToggle: (id: string) => void;
  disabled: boolean;
  empty: string;
}) {
  if (items.length === 0) return <p className="pt-2 text-xs text-muted-foreground">{empty}</p>;
  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {items.map((it) => {
        const on = selected.includes(it.id);
        return (
          <button
            key={it.id}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onToggle(it.id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors disabled:opacity-60',
              on ? 'border-brand-300 bg-brand-50 text-brand-900' : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {it.color && (
              <span className="size-2 rounded-full" style={{ background: it.color }} aria-hidden />
            )}
            {it.name}
          </button>
        );
      })}
    </div>
  );
}

/** Task details: edit everything, comments, and the full history. */
export function TaskDrawer({
  taskId,
  project,
  onClose,
}: {
  taskId: string | null;
  project: Project;
  onClose: () => void;
}) {
  const { user } = useTenantSession();
  const can = permissionsFor(user?.role);
  const task = useTask(taskId);
  const m = useTaskMutations(project.id);
  const [tab, setTab] = useState<'comments' | 'history'>('comments');
  const [newLabel, setNewLabel] = useState('');
  const writable = !project.archivedAt;
  const canEdit = writable && can.editTask;
  const onError = (err: unknown) => toast.error(errorMessage(err));
  const t = task.data;
  const update = (input: Parameters<typeof m.update.mutate>[0]['input']) =>
    t && m.update.mutate({ id: t.id, input }, { onError });
  const toggle = (list: string[], id: string) =>
    list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
  // Assignable people: project members (the owner can also be assigned).
  const people = [
    ...project.members.filter((x) => x.isActive),
    ...(user?.role === 'OWNER' && !project.members.some((x) => x.id === user.id)
      ? [{ id: user.id, name: user.name }]
      : []),
  ];

  return (
    <Sheet open={Boolean(taskId)} onOpenChange={(o) => !o && onClose()}>
      <SheetContent aria-describedby={undefined}>
        {task.isPending && <div className="m-6 h-40 animate-pulse rounded-lg bg-muted" />}
        {task.isError && <Alert className="m-6">{errorMessage(task.error)}</Alert>}
        {task.data === null && <Alert className="m-6">This task was deleted or you can't see it.</Alert>}
        {t && (
          <div className="grid gap-5 p-6">
            <div className="pr-8">
              <div className="mb-2 flex items-center gap-2">
                <Badge variant="secondary" className="font-mono">
                  {t.key}
                </Badge>
                {t.isOverdue && <Badge variant="destructive">Overdue</Badge>}
                {t.completedAt && (
                  <Badge variant="success">Done {new Date(t.completedAt).toLocaleDateString()}</Badge>
                )}
              </div>
              <SheetTitle className="sr-only">{t.title}</SheetTitle>
              <SheetDescription className="sr-only">Task details for {t.key}</SheetDescription>
              <InlineText
                label="Title"
                value={t.title}
                disabled={!canEdit}
                onSave={(title) => update({ title })}
                className="h-auto border-transparent px-1 text-lg font-semibold shadow-none hover:border-input"
              />
              <p className="mt-1 px-1 text-xs text-muted-foreground">
                Created by {t.createdBy.name} on {new Date(t.createdAt).toLocaleDateString()}
              </p>
            </div>

            <div className="divide-y rounded-lg border px-3">
              <Field label="Status">
                <NativeSelect
                  aria-label="Status"
                  value={t.status.id}
                  disabled={!canEdit}
                  onChange={(e) => m.move.mutate({ id: t.id, statusId: e.target.value }, { onError })}
                >
                  {project.statuses.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="Priority">
                <NativeSelect
                  aria-label="Priority"
                  value={t.priority}
                  disabled={!canEdit}
                  onChange={(e) => update({ priority: e.target.value as Priority })}
                >
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </NativeSelect>
              </Field>
              <Field label="Due date">
                <div className="flex gap-2">
                  <Input
                    type="date"
                    aria-label="Due date"
                    value={t.dueDate ?? ''}
                    disabled={!canEdit}
                    onChange={(e) => update({ dueDate: e.target.value || null })}
                  />
                  {t.dueDate && canEdit && (
                    <Button variant="ghost" onClick={() => update({ dueDate: null })}>
                      Clear
                    </Button>
                  )}
                </div>
              </Field>
              <Field label="Assignees">
                <ToggleChips
                  items={people}
                  selected={t.assignees.map((a) => a.id)}
                  disabled={!canEdit}
                  empty="Add members to the project first."
                  onToggle={(id) =>
                    update({
                      assigneeIds: toggle(
                        t.assignees.map((a) => a.id),
                        id,
                      ),
                    })
                  }
                />
              </Field>
              <Field label="Labels">
                <ToggleChips
                  items={project.labels}
                  selected={t.labels.map((l) => l.id)}
                  disabled={!canEdit}
                  empty="No labels yet."
                  onToggle={(id) =>
                    update({
                      labelIds: toggle(
                        t.labels.map((l) => l.id),
                        id,
                      ),
                    })
                  }
                />
                {canEdit && (
                  <form
                    className="mt-2 flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!newLabel.trim()) return;
                      m.createLabel.mutate(
                        { name: newLabel.trim() },
                        {
                          onSuccess: ({ createLabel }) => {
                            setNewLabel('');
                            update({ labelIds: [...t.labels.map((l) => l.id), createLabel.id] });
                          },
                          onError,
                        },
                      );
                    }}
                  >
                    <Input
                      aria-label="New label"
                      placeholder="New label"
                      className="h-8"
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                    />
                    <Button type="submit" size="sm" variant="secondary" disabled={!newLabel.trim()}>
                      Add
                    </Button>
                  </form>
                )}
              </Field>
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">Description</p>
              <InlineText
                label="Description"
                multiline
                value={t.description ?? ''}
                disabled={!canEdit}
                onSave={(description) => update({ description: description || null })}
              />
            </div>

            <div>
              <div className="mb-3 flex gap-4 border-b" role="tablist">
                {(['comments', 'history'] as const).map((k) => (
                  <button
                    key={k}
                    role="tab"
                    aria-selected={tab === k}
                    className={cn(
                      '-mb-px border-b-2 pb-2 text-sm font-medium capitalize',
                      tab === k ? 'border-primary text-primary' : 'border-transparent text-muted-foreground',
                    )}
                    onClick={() => setTab(k)}
                  >
                    {k === 'comments' ? `Comments (${t.comments.length})` : 'History'}
                  </button>
                ))}
              </div>
              {tab === 'comments' ? (
                <Comments
                  taskId={t.id}
                  projectId={project.id}
                  comments={t.comments}
                  canWrite={writable && can.comment}
                  canModerate={can.deleteTask}
                />
              ) : (
                <ol className="grid gap-3" aria-label="Task history">
                  {t.activity.map((a) => (
                    <li key={a.id} className="flex gap-2.5 text-sm">
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-semibold">
                        {initials(a.actor.name)}
                      </span>
                      <p>
                        <span className="font-medium">{a.actor.name}</span> {describeActivity(a)}
                        <span className="block text-xs text-muted-foreground">
                          {new Date(a.createdAt).toLocaleString()}
                        </span>
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {writable && can.deleteTask && (
              <Button
                variant="outline"
                className="justify-self-start text-destructive"
                onClick={() =>
                  window.confirm(`Delete ${t.key}? It is kept in history and can be restored later.`) &&
                  m.remove.mutate(t.id, {
                    onSuccess: () => (toast.success(`${t.key} deleted`), onClose()),
                    onError,
                  })
                }
              >
                <Trash2 /> Delete task
              </Button>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
