import { ArrowLeft } from 'lucide-react';
import { Link, NavLink, Route, Routes, useParams } from 'react-router';
import { errorMessage } from '@/api/errors';
import { FullPageSpinner } from '@/components/FullPageSpinner';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { permissionsFor } from '../permissions';
import { useTenantSession } from '../session';
import { useProject } from './queries';
import { BoardPage, InsightsPage } from '../board/BoardPage';
import { ProjectSettings } from './ProjectSettings';

const tab = ({ isActive }: { isActive: boolean }) =>
  cn(
    'border-b-2 px-1 pb-2 text-sm font-medium',
    isActive
      ? 'border-primary text-primary'
      : 'border-transparent text-muted-foreground hover:text-foreground',
  );

export function ProjectPage() {
  const { projectId = '' } = useParams();
  const { user } = useTenantSession();
  const can = permissionsFor(user?.role);
  const project = useProject(projectId);

  if (project.isPending) return <FullPageSpinner />;
  if (project.isError) return <Alert>{errorMessage(project.error)}</Alert>;
  if (!project.data) return <Alert>Project not found, or you are not a member.</Alert>;
  const p = project.data;

  return (
    <>
      <Link
        to="/projects"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Projects
      </Link>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{p.title}</h1>
        <Badge variant="secondary" className="font-mono">
          {p.shortCode}
        </Badge>
        {p.archivedAt && <Badge variant="outline">Archived · read-only</Badge>}
      </div>
      <nav className="mb-6 flex gap-5 border-b" aria-label="Project">
        <NavLink end to={`/projects/${p.id}`} className={tab}>
          Board
        </NavLink>
        <NavLink to={`/projects/${p.id}/insights`} className={tab}>
          Insights
        </NavLink>
        <NavLink to={`/projects/${p.id}/settings`} className={tab}>
          {can.manageStatuses ? 'Settings' : 'Details'}
        </NavLink>
      </nav>
      <Routes>
        <Route index element={<BoardPage project={p} />} />
        <Route path="insights" element={<InsightsPage project={p} />} />
        <Route path="settings" element={<ProjectSettings project={p} />} />
      </Routes>
    </>
  );
}
