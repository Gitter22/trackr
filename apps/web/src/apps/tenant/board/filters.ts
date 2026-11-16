import type { Priority, TaskFilter } from '@/api/generated/graphql';

/** Board filters, kept in the URL so a filtered board can be shared or reloaded. */
export interface BoardFilters {
  search: string;
  statusId: string;
  assigneeId: string;
  priority: Priority | '';
  dueFrom: string;
  dueTo: string;
  overdue: boolean;
}

const PRIORITIES: Priority[] = ['LOW', 'MEDIUM', 'HIGH'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** Hand-edited or stale URLs: keep only well-formed values. */
const id = (v: string | null) => (v && UUID.test(v) ? v : '');
const date = (v: string | null) => (v && DATE.test(v) ? v : '');

export function readFilters(params: URLSearchParams): BoardFilters {
  const priority = params.get('priority') as Priority | null;
  return {
    search: params.get('q') ?? '',
    statusId: id(params.get('status')),
    assigneeId: id(params.get('assignee')),
    priority: priority && PRIORITIES.includes(priority) ? priority : '',
    dueFrom: date(params.get('from')),
    dueTo: date(params.get('to')),
    overdue: params.get('overdue') === '1',
  };
}

/** Writes filters back, dropping empty ones and keeping unrelated params (e.g. ?task=). */
export function writeFilters(params: URLSearchParams, f: BoardFilters): URLSearchParams {
  const next = new URLSearchParams(params);
  const set = (k: string, v: string) => (v ? next.set(k, v) : next.delete(k));
  set('q', f.search);
  set('status', f.statusId);
  set('assignee', f.assigneeId);
  set('priority', f.priority);
  set('from', f.dueFrom);
  set('to', f.dueTo);
  set('overdue', f.overdue ? '1' : '');
  return next;
}

/** API filter for task queries. The status filter is applied by hiding columns, not here. */
export function toTaskFilter(f: BoardFilters): TaskFilter {
  const filter: TaskFilter = {};
  if (f.search.trim()) filter.search = f.search.trim();
  if (f.assigneeId) filter.assigneeIds = [f.assigneeId];
  if (f.priority) filter.priorities = [f.priority];
  if (f.dueFrom || f.dueTo) filter.due = { from: f.dueFrom || null, to: f.dueTo || null };
  if (f.overdue) filter.overdue = true;
  return filter;
}

export const hasFilters = (f: BoardFilters) =>
  Boolean(f.search || f.statusId || f.assigneeId || f.priority || f.dueFrom || f.dueTo || f.overdue);

export const EMPTY_FILTERS: BoardFilters = {
  search: '',
  statusId: '',
  assigneeId: '',
  priority: '',
  dueFrom: '',
  dueTo: '',
  overdue: false,
};
