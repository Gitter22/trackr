import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithQuery } from '@/test/render';
import { suggestShortCode } from './projects/CreateProjectDialog';
import type { Role } from './session';
import { TenantApp } from './TenantApp';

// Fake backends: REST (axios instance from createTenantApi) and GraphQL (createGqlRequest).
const rest = { get: vi.fn(), post: vi.fn(), patch: vi.fn() };
const gqlCalls: { op: string; vars: unknown }[] = [];
let gqlHandlers: Record<string, (vars: unknown) => unknown> = {};

vi.mock('@/api/rest', () => ({ createTenantApi: () => rest, adminApi: {} }));
vi.mock('@/api/gql', () => ({
  createGqlRequest: () => async (doc: { definitions: { name?: { value: string } }[] }, vars: unknown) => {
    const op = doc.definitions[0].name!.value;
    gqlCalls.push({ op, vars });
    const handler = gqlHandlers[op];
    if (!handler) throw new Error(`no handler for ${op}`);
    return handler(vars);
  },
}));

const users = [
  { id: 'u-owner', email: 'john@kik.test', name: 'John Owner', role: 'OWNER', isActive: true },
  { id: 'u-mary', email: 'mary@kik.test', name: 'Mary Member', role: 'MEMBER', isActive: true },
];
const project = {
  id: 'p1',
  title: 'Kiksasa Web',
  description: 'Website',
  shortCode: 'KIK',
  archivedAt: null,
  archivedBy: null,
  taskCount: 3,
  members: [{ id: 'u-mary', name: 'Mary Member' }],
};

function signedInAs(role: Role) {
  const me = {
    ...users[0],
    role,
    id: role === 'OWNER' ? 'u-owner' : 'u-mary',
    name: role === 'OWNER' ? 'John Owner' : 'Mary Member',
  };
  localStorage.setItem('trcker:kik:token', 'tok');
  rest.get.mockImplementation(async (url: string) => {
    if (url === '/auth/me')
      return { data: { user: me, org: { slug: 'kik', title: 'Kiksasa', timezone: 'UTC' } } };
    if (url === '/users') return { data: { users } };
    throw new Error(`GET ${url}`);
  });
}

beforeEach(() => {
  localStorage.clear();
  gqlCalls.length = 0;
  gqlHandlers = { Projects: () => ({ projects: [project] }) };
  vi.spyOn(axios, 'get').mockResolvedValue({
    data: { org: { slug: 'kik', title: 'Kiksasa', timezone: 'UTC' } },
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  rest.get.mockReset();
  rest.post.mockReset();
  rest.patch.mockReset();
});

const go = (path: string) => window.history.pushState({}, '', path);

describe('tenant sign-in', () => {
  it('shows the org login, then stores a slug-scoped token and opens projects', async () => {
    go('/projects');
    rest.post.mockImplementation(async (_url: string, body: { password: string }) => {
      if (body.password !== 'OrgOwner@123')
        throw Object.assign(new Error('401'), {
          isAxiosError: true,
          response: { status: 401, data: { error: { message: 'Wrong email or password' } } },
        });
      signedInAs('OWNER');
      return { data: { token: 'tok', user: users[0] } };
    });
    const user = userEvent.setup();
    renderWithQuery(<TenantApp slug="kik" />);

    expect(await screen.findByRole('heading', { name: 'Sign in to Kiksasa' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Email'), 'john@kik.test');
    await user.type(screen.getByLabelText('Password'), 'nope');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong email or password');

    await user.clear(screen.getByLabelText('Password'));
    await user.type(screen.getByLabelText('Password'), 'OrgOwner@123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('heading', { name: 'Projects' })).toBeInTheDocument();
    expect(localStorage.getItem('trcker:kik:token')).toBe('tok');
  });
});

describe('projects', () => {
  it('owner can create a project; the short code is suggested from the title', async () => {
    go('/projects');
    signedInAs('OWNER');
    gqlHandlers.CreateProject = () => ({ createProject: { id: 'p2', shortCode: 'MA' } });
    gqlHandlers.Project = () => ({ project: null });
    const user = userEvent.setup();
    renderWithQuery(<TenantApp slug="kik" />);

    expect(await screen.findByText('Kiksasa Web')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /new project/i }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Title'), 'Mobile App');
    expect(within(dialog).getByLabelText('Short code')).toHaveValue('MA');
    await user.click(within(dialog).getByLabelText(/Mary Member/));
    await user.click(within(dialog).getByRole('button', { name: 'Create project' }));
    await waitFor(() =>
      expect(gqlCalls.find((c) => c.op === 'CreateProject')?.vars).toEqual({
        input: { title: 'Mobile App', description: null, shortCode: 'MA', memberIds: ['u-mary'] },
      }),
    );
  });

  it('members see their projects but no create or archive buttons', async () => {
    go('/projects');
    signedInAs('MEMBER');
    renderWithQuery(<TenantApp slug="kik" />);
    expect(await screen.findByText('Kiksasa Web')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /new project/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /archive/i })).not.toBeInTheDocument();
    expect(screen.getByText(/3 tasks · 1 member/)).toBeInTheDocument();
  });
});

describe('users', () => {
  it('owner changes roles; the owner row is not editable', async () => {
    go('/users');
    signedInAs('OWNER');
    rest.patch.mockResolvedValue({ data: { user: { ...users[1], role: 'ADMIN' } } });
    const user = userEvent.setup();
    renderWithQuery(<TenantApp slug="kik" />);
    await user.selectOptions(await screen.findByLabelText('Role for Mary Member'), 'ADMIN');
    expect(rest.patch).toHaveBeenCalledWith('/users/u-mary', { role: 'ADMIN' });
    expect(screen.queryByLabelText('Role for John Owner')).not.toBeInTheDocument();
  });

  it('members get a read-only list', async () => {
    go('/users');
    signedInAs('MEMBER');
    renderWithQuery(<TenantApp slug="kik" />);
    expect(await screen.findByText('john@kik.test')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /new user/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});

describe('suggestShortCode', () => {
  it.each([
    ['Kiksasa', 'KIK'],
    ['Kiksasa Web', 'KW'],
    ['Mobile App Two', 'MAT'],
    ['2026 Plan', 'P'],
  ])('%s -> %s', (title, code) => expect(suggestShortCode(title)).toBe(code));
});
