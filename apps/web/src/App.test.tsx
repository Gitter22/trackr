import { screen } from '@testing-library/react';
import axios from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { adminApi } from './api/rest';
import { App } from './App';
import { renderWithQuery } from './test/render';

afterEach(() => vi.restoreAllMocks());

describe('App host routing', () => {
  it('shows marketing on the root domain', () => {
    renderWithQuery(<App hostname="localhost" />);
    expect(screen.getByRole('link', { name: 'Go to admin portal' })).toHaveAttribute(
      'href',
      'http://admin.localhost:3000/login',
    );
  });

  it('shows the control panel on admin.<domain>', async () => {
    vi.spyOn(adminApi, 'get').mockRejectedValue(
      Object.assign(new Error('401'), { response: { status: 401 } }),
    );
    renderWithQuery(<App hostname="admin.localhost" />);
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('shows the tenant app for an active tenant', async () => {
    vi.spyOn(axios, 'get').mockResolvedValue({
      data: { org: { slug: 'kik', title: 'Kiksasa', timezone: 'UTC' } },
    });
    renderWithQuery(<App hostname="kik.localhost" />);
    expect(await screen.findByRole('heading', { name: 'Sign in to Kiksasa' })).toBeInTheDocument();
  });

  it('shows 404 for an unknown tenant', async () => {
    vi.spyOn(axios, 'get').mockRejectedValue(
      Object.assign(new Error('404'), { isAxiosError: true, response: { status: 404 } }),
    );
    renderWithQuery(<App hostname="nope.localhost" />);
    expect(await screen.findByText('404')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /home/i })).toHaveAttribute(
      'href',
      expect.stringMatching(/^http:\/\/localhost/),
    );
  });
});
