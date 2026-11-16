import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { adminApi } from '@/api/rest';
import { renderWithQuery } from '@/test/render';
import { AdminApp } from './AdminApp';

const admin = { id: 'a1', email: 'superadmin@trackr.com', name: 'Super Admin' };
const owner = {
  id: 'u1',
  name: 'John Doe',
  email: 'john@example.com',
  createdAt: '2026-11-16T00:00:00Z',
  organizations: [],
};
const org = {
  id: 'o1',
  title: 'Kiksasa',
  slug: 'kiksasa',
  dbName: 'tenant_kiksasa_db',
  status: 'ACTIVE',
  provisionError: null,
  projectLimit: 5,
  timezone: 'Asia/Kolkata',
  createdAt: '2026-11-16T00:00:00Z',
  owner,
};
const unauthorized = () =>
  Promise.reject(
    Object.assign(new Error('401'), {
      response: { status: 401, data: { error: { message: 'Wrong email or password' } } },
      isAxiosError: true,
    }),
  );

function mockApi(opts: { signedIn: boolean }) {
  let signedIn = opts.signedIn;
  vi.spyOn(adminApi, 'get').mockImplementation(async (url: string) => {
    if (url === '/auth/me') return signedIn ? { data: { admin } } : unauthorized();
    if (url === '/organizations') return { data: { organizations: [org] } };
    if (url === '/users') return { data: { users: [owner] } };
    throw new Error(`unexpected GET ${url}`);
  });
  const post = vi.spyOn(adminApi, 'post').mockImplementation(async (url: string, body?: unknown) => {
    if (url === '/auth/login') {
      const { password } = body as { password: string };
      if (password !== 'Test@123') return unauthorized();
      signedIn = true;
      return { data: { admin } };
    }
    if (url === '/organizations')
      return { data: { organization: { ...org, ...(body as object), id: 'o2', status: 'ACTIVE' } } };
    throw new Error(`unexpected POST ${url}`);
  });
  const patch = vi.spyOn(adminApi, 'patch').mockResolvedValue({ data: {} });
  return { post, patch };
}

beforeEach(() => window.history.pushState({}, '', '/'));
afterEach(() => vi.restoreAllMocks());

describe('control panel', () => {
  it('sends signed-out visitors to login, shows errors, then signs in', async () => {
    mockApi({ signedIn: false });
    const user = userEvent.setup();
    renderWithQuery(<AdminApp />);
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter a valid email')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Email'), 'superadmin@trackr.com');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong email or password');

    await user.clear(screen.getByLabelText('Password'));
    await user.type(screen.getByLabelText('Password'), 'Test@123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('heading', { name: 'Organizations' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /kiksasa\.localhost/ })).toHaveAttribute(
      'href',
      'http://kiksasa.localhost:3000/login',
    );
  });

  it('deactivates an organization', async () => {
    const { patch } = mockApi({ signedIn: true });
    const user = userEvent.setup();
    renderWithQuery(<AdminApp />);
    const row = (await screen.findByText('Kiksasa')).closest('tr')!;
    expect(within(row).getByText('Active')).toBeInTheDocument();
    await user.click(within(row).getByRole('button', { name: 'Deactivate' }));
    await waitFor(() =>
      expect(patch).toHaveBeenCalledWith('/organizations/o1/status', { status: 'INACTIVE' }),
    );
  });

  it('creates an organization: slug follows the title and is validated', async () => {
    const { post } = mockApi({ signedIn: true });
    const user = userEvent.setup();
    renderWithQuery(<AdminApp />);
    await user.click(await screen.findByRole('button', { name: /new organization/i }));
    const dialog = await screen.findByRole('dialog');

    await user.type(within(dialog).getByLabelText('Name'), 'Acme Labs');
    expect(within(dialog).getByLabelText('Address (slug)')).toHaveValue('acme-labs');

    await user.clear(within(dialog).getByLabelText('Address (slug)'));
    await user.type(within(dialog).getByLabelText('Address (slug)'), 'admin');
    await user.click(within(dialog).getByRole('button', { name: 'Create organization' }));
    expect(await within(dialog).findByText('This address is reserved')).toBeInTheDocument();
    expect(within(dialog).getByText('Pick an owner')).toBeInTheDocument();

    await user.clear(within(dialog).getByLabelText('Address (slug)'));
    await user.type(within(dialog).getByLabelText('Address (slug)'), 'acme');
    await user.selectOptions(within(dialog).getByLabelText('Owner'), 'u1');
    await user.click(within(dialog).getByRole('button', { name: 'Create organization' }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        '/organizations',
        expect.objectContaining({ title: 'Acme Labs', slug: 'acme', ownerId: 'u1', projectLimit: 10 }),
      ),
    );
  });
});
