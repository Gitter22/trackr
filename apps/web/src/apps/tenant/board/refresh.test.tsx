import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { projectKeys } from '../projects/queries';
import { TenantSessionProvider } from '../session';
import { boardKeys, useTaskMutations } from './queries';

vi.mock('@/api/rest', () => ({
  createTenantApi: () => ({ get: vi.fn().mockResolvedValue({ data: {} }) }),
  adminApi: {},
}));
vi.mock('@/api/gql', () => ({ createGqlRequest: () => async () => ({}) }));

const P = 'p1';
const keys = {
  todo: boardKeys.column(P, 's-todo', {}),
  todoFiltered: boardKeys.column(P, 's-todo', { priorities: ['HIGH'] }),
  doing: boardKeys.column(P, 's-doing', {}),
  done: boardKeys.column(P, 's-done', {}),
  summary: boardKeys.summary(P, {}),
  task: boardKeys.task('t1'),
  otherTask: boardKeys.task('t2'),
  project: projectKeys.detail(P),
  list: projectKeys.list(false),
};
type Name = keyof typeof keys;

let qc: QueryClient;
beforeEach(() => {
  qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  for (const k of Object.values(keys)) qc.setQueryData(k, {});
});

function setup() {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <TenantSessionProvider slug="kik">{children}</TenantSessionProvider>
    </QueryClientProvider>
  );
  return renderHook(() => useTaskMutations(P), { wrapper }).result;
}

const stale = () =>
  (Object.keys(keys) as Name[]).filter((n) => qc.getQueryState(keys[n])?.isInvalidated).sort();

describe('task mutations refresh only what they change', () => {
  it('move: source and target columns (all filters), summary, the task; not the project', async () => {
    const m = setup();
    await act(() => m.current.move.mutateAsync({ id: 't1', statusId: 's-doing', fromStatusId: 's-todo' }));
    expect(stale()).toEqual(['doing', 'summary', 'task', 'todo', 'todoFiltered']);
  });

  it('update and comments: only the task’s own column', async () => {
    const m = setup();
    await act(() => m.current.update.mutateAsync({ id: 't1', statusId: 's-done', input: { title: 'x' } }));
    expect(stale()).toEqual(['done', 'summary', 'task']);
    for (const k of Object.values(keys)) qc.setQueryData(k, {});
    await act(() => m.current.addComment.mutateAsync({ taskId: 't1', statusId: 's-done', body: 'hi' }));
    expect(stale()).toEqual(['done', 'summary', 'task']);
  });

  it('create and delete also refresh project task counts, but not the project detail', async () => {
    const m = setup();
    await act(() => m.current.create.mutateAsync({ projectId: P, title: 'New', statusId: 's-todo' }));
    expect(stale()).toEqual(['list', 'summary', 'todo', 'todoFiltered']);
    for (const k of Object.values(keys)) qc.setQueryData(k, {});
    await act(() => m.current.remove.mutateAsync({ id: 't1', statusId: 's-doing' }));
    expect(stale()).toEqual(['doing', 'list', 'summary']);
  });

  it('create without a status refreshes every column', async () => {
    const m = setup();
    await act(() => m.current.create.mutateAsync({ projectId: P, title: 'New' }));
    expect(stale()).toEqual(['doing', 'done', 'list', 'summary', 'todo', 'todoFiltered']);
  });

  it('a new label refreshes the project (labels live there)', async () => {
    const m = setup();
    await act(() => m.current.createLabel.mutateAsync({ name: 'bug' }));
    expect(stale()).toEqual(['list', 'project']);
  });
});
