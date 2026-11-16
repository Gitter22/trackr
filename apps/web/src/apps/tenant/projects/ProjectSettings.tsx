import { UserMinus } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { errorMessage } from '@/api/errors';
import type { ProjectQuery } from '@/api/generated/graphql';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { permissionsFor } from '../permissions';
import { useTenantSession } from '../session';
import { useUsers } from '../users/queries';
import { useProjectMutations } from './queries';
import { StatusList } from './StatusList';

type Project = NonNullable<ProjectQuery['project']>;

function DetailsCard({ project, editable }: { project: Project; editable: boolean }) {
  const { update } = useProjectMutations();
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description ?? '');
  const dirty = title !== project.title || description !== (project.description ?? '');
  return (
    <Card>
      <CardHeader>
        <CardTitle>Details</CardTitle>
        <CardDescription>
          Created by {project.createdBy.name} on {new Date(project.createdAt).toLocaleDateString()}. Short
          code {project.shortCode} can't change.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            update.mutate(
              { id: project.id, title: title.trim(), description: description.trim() || null },
              {
                onSuccess: () => toast.success('Project saved'),
                onError: (err) => toast.error(errorMessage(err)),
              },
            );
          }}
        >
          <FormField label="Title" htmlFor="settings-title">
            <Input
              id="settings-title"
              value={title}
              disabled={!editable}
              onChange={(e) => setTitle(e.target.value)}
            />
          </FormField>
          <FormField label="Description" htmlFor="settings-description">
            <Textarea
              id="settings-description"
              rows={3}
              value={description}
              disabled={!editable}
              onChange={(e) => setDescription(e.target.value)}
            />
          </FormField>
          {editable && (
            <div>
              <Button type="submit" disabled={!dirty || !title.trim() || update.isPending}>
                Save
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

function MembersCard({ project, editable }: { project: Project; editable: boolean }) {
  const users = useUsers();
  const { addMember, removeMember } = useProjectMutations();
  const [pick, setPick] = useState('');
  const memberIds = new Set(project.members.map((m) => m.id));
  const candidates =
    users.data?.filter((u) => u.isActive && u.role !== 'OWNER' && !memberIds.has(u.id)) ?? [];
  const onError = (err: unknown) => toast.error(errorMessage(err));
  return (
    <Card>
      <CardHeader>
        <CardTitle>Members</CardTitle>
        <CardDescription>Only members (and the owner) can see this project.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <ul className="divide-y rounded-md border">
          {project.members.length === 0 && (
            <li className="p-3 text-sm text-muted-foreground">No members yet.</li>
          )}
          {project.members.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 p-3">
              <div>
                <p className="text-sm font-medium">
                  {m.name} {!m.isActive && <Badge variant="outline">inactive</Badge>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {m.email} · {m.role.toLowerCase()}
                </p>
              </div>
              {editable && (
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Remove ${m.name}`}
                  onClick={() => removeMember.mutate({ projectId: project.id, userId: m.id }, { onError })}
                >
                  <UserMinus />
                </Button>
              )}
            </li>
          ))}
        </ul>
        {editable && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (pick)
                addMember.mutate(
                  { projectId: project.id, userId: pick },
                  { onSuccess: () => setPick(''), onError },
                );
            }}
          >
            <NativeSelect
              aria-label="User to add"
              value={pick}
              onChange={(e) => setPick(e.target.value)}
              className="min-w-56"
            >
              <option value="">{candidates.length ? 'Add a member…' : 'Everyone is already a member'}</option>
              {candidates.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role.toLowerCase()})
                </option>
              ))}
            </NativeSelect>
            <Button type="submit" variant="secondary" disabled={!pick || addMember.isPending}>
              Add
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

export function ProjectSettings({ project }: { project: Project }) {
  const { user } = useTenantSession();
  const can = permissionsFor(user?.role);
  const writable = !project.archivedAt;
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="grid content-start gap-6">
        <DetailsCard project={project} editable={writable && can.editProject} />
        <MembersCard project={project} editable={writable && can.manageMembers} />
      </div>
      <Card className="content-start">
        <CardHeader>
          <CardTitle>Statuses</CardTitle>
          <CardDescription>
            Board columns, in order. Drag to reorder. The category drives analytics and overdue rules.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StatusList
            projectId={project.id}
            statuses={project.statuses}
            editable={writable && can.manageStatuses}
          />
        </CardContent>
      </Card>
    </div>
  );
}
