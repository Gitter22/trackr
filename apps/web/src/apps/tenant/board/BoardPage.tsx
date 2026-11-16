import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import type { ProjectQuery } from '@/api/generated/graphql';
import { permissionsFor } from '../permissions';
import { useTenantSession } from '../session';
import { Board } from './Board';
import { FilterBar } from './FilterBar';
import { readFilters, toTaskFilter, writeFilters, type BoardFilters } from './filters';
import { SummaryPanel } from './Summary';
import { TaskDrawer } from './TaskDrawer';

type Project = NonNullable<ProjectQuery['project']>;

/** Filters and the open task live in the URL (?q=&assignee=&task=...). */
function useBoardUrl() {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => readFilters(params), [params]);
  const filterKey = JSON.stringify(filters);
  // Stable object for query keys: only changes when a filter value changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const taskFilter = useMemo(() => toTaskFilter(filters), [filterKey]);
  const setFilters = useCallback(
    (f: BoardFilters) => setParams((p) => writeFilters(p, f), { replace: true }),
    [setParams],
  );
  const taskId = params.get('task');
  const openTask = useCallback(
    (id: string | null) =>
      setParams((p) => {
        const next = new URLSearchParams(p);
        if (id) next.set('task', id);
        else next.delete('task');
        return next;
      }),
    [setParams],
  );
  return { filters, taskFilter, setFilters, taskId, openTask };
}

export function BoardPage({ project }: { project: Project }) {
  const { user } = useTenantSession();
  const can = permissionsFor(user?.role);
  const { filters, taskFilter, setFilters, taskId, openTask } = useBoardUrl();
  const writable = !project.archivedAt;
  const columns = filters.statusId
    ? project.statuses.filter((s) => s.id === filters.statusId)
    : project.statuses;

  return (
    <>
      <FilterBar
        value={filters}
        onChange={setFilters}
        statuses={project.statuses}
        members={project.members}
      />
      <Board
        projectId={project.id}
        statuses={columns}
        filter={taskFilter}
        canCreate={writable && can.createTask}
        canMove={writable && can.editTask}
        onOpen={openTask}
      />
      <TaskDrawer taskId={taskId} project={project} onClose={() => openTask(null)} />
    </>
  );
}

export function InsightsPage({ project }: { project: Project }) {
  const { filters, taskFilter, setFilters } = useBoardUrl();
  return (
    <>
      <FilterBar
        value={filters}
        onChange={setFilters}
        statuses={project.statuses}
        members={project.members}
        showStatus={false}
      />
      <SummaryPanel projectId={project.id} filter={taskFilter} />
    </>
  );
}
