import { beforeEach, describe, expect, it } from 'vitest';
import { TOKEN_KEY, tenantStorage } from './storage';

beforeEach(() => localStorage.clear());

describe('tenantStorage', () => {
  it('prefixes keys with the tenant slug', () => {
    tenantStorage('kiksasa').set(TOKEN_KEY, 'abc');
    expect(localStorage.getItem('trcker:kiksasa:token')).toBe('abc');
  });

  it('keeps sessions of different orgs apart', () => {
    const a = tenantStorage('acme');
    const b = tenantStorage('globex');
    a.set(TOKEN_KEY, 'token-a');
    b.set(TOKEN_KEY, 'token-b');
    expect(a.get(TOKEN_KEY)).toBe('token-a');
    b.remove(TOKEN_KEY);
    expect(b.get(TOKEN_KEY)).toBeNull();
    expect(a.get(TOKEN_KEY)).toBe('token-a');
  });
});
