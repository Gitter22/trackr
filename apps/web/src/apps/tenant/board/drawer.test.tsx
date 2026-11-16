import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithQuery } from '@/test/render';
import { TenantSessionProvider } from '../session';
import { TaskDrawer } from './TaskDrawer';

const rest = { get: vi.fn(), post: vi.fn(), patch: vi.fn() };
const calls: { op: string; vars: Record<string, unknown> }[] = [];
let handlers: Record<string, (v: Record<string, unknown>) => unknown> = {};
vi.mock('@/api/rest', () => ({ createTenantApi: () => rest, adminApi: {} }));
vi.mock('@/api/gql', () => ({
  createGqlRequest:
    () => async (doc: { definitions: { name?: { value: string } }[] }, vars: Record<string, unknown>) => {
      const op = doc.definitions[0].name!.value;
      calls.push({ op, vars });
      return handlers[op](vars);
    },
}));

const mary = { id: 'u-mary', name: 'Mary Member' };
const project = {
  id: 'p1',
  title: 'Board',
  description: null,
  shortCode: 'KIK',
  archivedAt: null,
  createdAt: '2026-11-16T00:00:00Z',
  createdBy: { id: 'u-owner', name: 'John' },
  members: [{ ...mary, email: 'm@x', role: 'MEMBER' as const, isActive: true }],
  statuses: [
    { id: 's1', name: 'To Do', category: 'NOT_STARTED' as const, position: 100, color: '#999999' },
    { id: 's2', name: 'Done', category: 'COMPLETED' as const, position: 200, color: '#00AA00' },
  ],
  labels: [{ id: 'l1', name: 'bug', color: '#FF0000' }],
};
const task = {
  id: 't1',
  key: 'KIK-7',
  title: 'Fix login',
  description: null,
  priority: 'HIGH',
  dueDate: '2026-01-01',
  isOverdue: true,
  completedAt: null,
  createdAt: '2026-11-16T00:00:00Z',
  updatedAt: '2026-11-16T00:00:00Z',
  createdBy: { id: 'u-owner', name: 'John' },
  status: { id: 's1', name: 'To Do', category: 'NOT_STARTED' },
  assignees: [],
  labels: [],
  comments: [
    {
      id: 'c1',
      body: 'Can you look?',
      isDeleted: false,
      createdAt: '2026-11-16T10:00:00Z',
      editedAt: null,
      author: { id: 'u-owner', name: 'John' },
      replies: [],
    },
  ],
  activity: [
    {
      id: 'a2',
      type: 'STATUS_CHANGED',
      field: 'status',
      fromValue: { name: 'Done' },
      toValue: { name: 'To Do' },
      createdAt: '2026-11-16T11:00:00Z',
      actor: mary,
    },
    {
      id: 'a1',
      type: 'CREATED',
      field: null,
      fromValue: null,
      toValue: null,
      createdAt: '2026-11-16T09:00:00Z',
      actor: { id: 'u-owner', name: 'John' },
    },
  ],
};

function renderDrawer() {
  localStorage.setItem('trcker:kik:token', 'tok');
  rest.get.mockResolvedValue({
    data: {
      user: { ...mary, email: 'm@x', role: 'MEMBER', isActive: true },
      org: { slug: 'kik', title: 'K', timezone: 'UTC' },
    },
  });
  return renderWithQuery(
    <TenantSessionProvider slug="kik">
      <TaskDrawer taskId="t1" project={project} onClose={() => {}} />
    </TenantSessionProvider>,
  );
}

beforeEach(() => {
  calls.length = 0;
  handlers = {
    TaskDetail: () => ({ task }),
    AddComment: () => ({ addComment: { id: 'new' } }),
    UpdateTask: () => ({ updateTask: { id: 't1' } }),
  };
});

describe('task drawer', () => {
  it('shows the task, edits fields, replies to a comment, and shows history', async () => {
    const user = userEvent.setup();
    renderDrawer();
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByDisplayValue('Fix login')).toBeInTheDocument();
    expect(within(dialog).getByText('Overdue')).toBeInTheDocument();

    // Assign Mary and add the "bug" label (each a toggle chip).
    await user.click(within(dialog).getByRole('button', { name: 'Mary Member' }));
    await waitFor(() =>
      expect(calls.find((c) => c.op === 'UpdateTask')?.vars).toEqual({
        id: 't1',
        input: { assigneeIds: ['u-mary'] },
      }),
    );

    // Reply to John's comment.
    await user.click(within(dialog).getByRole('button', { name: 'Reply' }));
    await user.type(within(dialog).getByLabelText('Reply to John'), 'On it{Enter}');
    // The reply form's submit button is the last "Reply" button.
    await user.click(within(dialog).getAllByRole('button', { name: 'Reply' }).at(-1)!);
    await waitFor(() =>
      expect(calls.find((c) => c.op === 'AddComment')?.vars).toEqual({
        input: { taskId: 't1', body: 'On it', parentId: 'c1' },
      }),
    );

    // Members can't delete tasks.
    expect(within(dialog).queryByRole('button', { name: /delete task/i })).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole('tab', { name: 'History' }));
    const history = within(dialog).getByRole('list', { name: 'Task history' });
    expect(history).toHaveTextContent('Mary Member moved this from Done to To Do');
    expect(history).toHaveTextContent('John created this task');
  });
});
