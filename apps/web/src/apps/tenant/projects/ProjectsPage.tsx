import { Archive, ArchiveRestore, FolderKanban } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { errorMessage } from '@/api/errors';
import { PageHeader } from '@/components/layout/AppShell';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { permissionsFor } from '../permissions';
import { useTenantSession } from '../session';
import { CreateProjectDialog } from './CreateProjectDialog';
import { useProjectMutations, useProjects } from './queries';

export function ProjectsPage() {
  const { user } = useTenantSession();
  const can = permissionsFor(user?.role);
  const [showArchived, setShowArchived] = useState(false);
  const projects = useProjects(showArchived);
  const { archive, unarchive } = useProjectMutations();
  const onError = (err: unknown) => toast.error(errorMessage(err));

  return (
    <>
      <PageHeader
        title="Projects"
        description={can.createProject ? 'All projects in this workspace.' : 'Projects you are a member of.'}
        actions={can.createProject ? <CreateProjectDialog /> : undefined}
      />
      {can.archiveProject && (
        <label className="mb-4 flex w-fit items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            className="accent-primary"
            checked={showArchived}
            onChange={(e) => setShowArchived(e.target.checked)}
          />
          Show archived projects
        </label>
      )}
      {projects.isError && <Alert>{errorMessage(projects.error)}</Alert>}
      {projects.data?.length === 0 && (
        <div className="rounded-xl border border-dashed bg-card p-10 text-center">
          <FolderKanban className="mx-auto mb-3 size-8 text-primary" />
          <p className="font-medium">No projects yet</p>
          <p className="text-sm text-muted-foreground">
            {can.createProject
              ? 'Create your first project to start tracking tasks.'
              : 'Ask your workspace owner to add you to a project.'}
          </p>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {projects.data?.map((p) => (
          <div
            key={p.id}
            className={`flex flex-col rounded-xl border bg-card p-5 shadow-sm ${p.archivedAt ? 'opacity-70' : ''}`}
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <Link to={`/projects/${p.id}`} className="font-semibold hover:text-primary">
                {p.title}
              </Link>
              <Badge variant="secondary" className="font-mono">
                {p.shortCode}
              </Badge>
            </div>
            <p className="line-clamp-2 min-h-10 text-sm text-muted-foreground">
              {p.description || 'No description'}
            </p>
            <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {p.taskCount} task{p.taskCount === 1 ? '' : 's'} · {p.members.length} member
                {p.members.length === 1 ? '' : 's'}
              </span>
              {p.archivedAt && (
                <Badge variant="outline">Archived{p.archivedBy ? ` by ${p.archivedBy.name}` : ''}</Badge>
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <Button asChild size="sm" variant="secondary" className="flex-1">
                <Link to={`/projects/${p.id}`}>Open board</Link>
              </Button>
              {can.archiveProject &&
                (p.archivedAt ? (
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={`Restore ${p.title}`}
                    onClick={() =>
                      unarchive.mutate(p.id, {
                        onError,
                        onSuccess: () => toast.success(`${p.title} restored`),
                      })
                    }
                  >
                    <ArchiveRestore />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={`Archive ${p.title}`}
                    onClick={() => {
                      if (
                        window.confirm(`Archive ${p.title}? It becomes read-only and hidden from members.`)
                      ) {
                        archive.mutate(p.id, {
                          onError,
                          onSuccess: () => toast.success(`${p.title} archived`),
                        });
                      }
                    }}
                  >
                    <Archive />
                  </Button>
                ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
