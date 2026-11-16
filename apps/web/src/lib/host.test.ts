import { describe, expect, it } from 'vitest';
import { hostUrl, parseHost } from './host';

describe('parseHost', () => {
  it.each([
    ['localhost', { kind: 'marketing' }],
    ['admin.localhost', { kind: 'admin' }],
    ['kiksasa.localhost', { kind: 'tenant', slug: 'kiksasa' }],
    ['KikSasa.LOCALHOST', { kind: 'tenant', slug: 'kiksasa' }],
    ['a.b.localhost', { kind: 'unknown' }],
    ['example.com', { kind: 'unknown' }],
    ['evil-localhost', { kind: 'unknown' }],
  ])('%s', (host, expected) => {
    expect(parseHost(host, 'localhost')).toEqual(expected);
  });

  it('works with a real domain', () => {
    expect(parseHost('acme.trcker.com', 'trcker.com')).toEqual({ kind: 'tenant', slug: 'acme' });
    expect(parseHost('trcker.com', 'trcker.com')).toEqual({ kind: 'marketing' });
  });
});

describe('hostUrl', () => {
  const loc = { protocol: 'http:', port: '5173' };
  it('builds links to the other apps on the same port', () => {
    expect(hostUrl('marketing', loc, 'localhost')).toBe('http://localhost:5173/');
    expect(hostUrl('admin', loc, 'localhost', '/login')).toBe('http://admin.localhost:5173/login');
    expect(hostUrl({ slug: 'kik' }, { protocol: 'https:', port: '' }, 'trcker.com')).toBe(
      'https://kik.trcker.com/',
    );
  });
});
