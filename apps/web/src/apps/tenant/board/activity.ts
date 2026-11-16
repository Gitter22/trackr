import type { TaskDetailQuery } from '@/api/generated/graphql';

type Activity = NonNullable<TaskDetailQuery['task']>['activity'][number];

const FIELD: Record<string, string> = {
  title: 'title',
  description: 'description',
  priority: 'priority',
  dueDate: 'due date',
};
const nameOf = (v: unknown) =>
  v && typeof v === 'object' && 'name' in v ? String((v as { name: unknown }).name) : null;
function show(v: unknown): string {
  if (v === null || v === undefined || v === '') return 'none';
  // Enum values like HIGH -> High; everything else as-is.
  if (typeof v === 'string' && /^[A-Z_]+$/.test(v)) return v.charAt(0) + v.slice(1).toLowerCase();
  return String(v);
}

/** One readable sentence per history entry, e.g. "moved this from To Do to Done". */
export function describeActivity(a: Pick<Activity, 'type' | 'field' | 'fromValue' | 'toValue'>): string {
  switch (a.type) {
    case 'CREATED':
      return 'created this task';
    case 'STATUS_CHANGED':
      return `moved this from ${nameOf(a.fromValue) ?? '?'} to ${nameOf(a.toValue) ?? '?'}`;
    case 'ASSIGNEE_ADDED':
      return `assigned ${nameOf(a.toValue) ?? 'someone'}`;
    case 'ASSIGNEE_REMOVED':
      return `unassigned ${nameOf(a.fromValue) ?? 'someone'}`;
    case 'LABEL_ADDED':
      return `added label ${nameOf(a.toValue) ?? ''}`.trim();
    case 'LABEL_REMOVED':
      return `removed label ${nameOf(a.fromValue) ?? ''}`.trim();
    case 'COMMENTED':
      return (a.toValue as { reply?: boolean } | null)?.reply ? 'replied to a comment' : 'commented';
    case 'COMMENT_DELETED':
      return 'deleted a comment';
    case 'DELETED':
      return 'deleted this task';
    case 'RESTORED':
      return 'restored this task';
    case 'UPDATED': {
      const field = FIELD[a.field ?? ''] ?? a.field ?? 'a field';
      if (a.field === 'description') return 'edited the description';
      return `changed ${field} from ${show(a.fromValue)} to ${show(a.toValue)}`;
    }
    default:
      return 'made a change';
  }
}
