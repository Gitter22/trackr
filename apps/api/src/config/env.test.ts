import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

function exampleEnv(): Record<string, string> {
  const text = fs.readFileSync(path.resolve(__dirname, '../../../../.env.example'), 'utf8');
  return Object.fromEntries(
    text
      .split('\n')
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
  );
}

describe('parseEnv', () => {
  it('accepts .env.example and coerces numbers', () => {
    const env = parseEnv(exampleEnv());
    expect(env.TENANT_DB_CONNECTION_LIMIT).toBe(5);
    expect(env.SUPERADMIN_EMAIL).toBe('superadmin@trackr.com');
  });

  it('lists every invalid key', () => {
    expect(() => parseEnv({ ...exampleEnv(), JWT_SECRET: 'short', TENANT_DB_SECRET_KEY: 'x' })).toThrow(
      /JWT_SECRET[\s\S]*TENANT_DB_SECRET_KEY|TENANT_DB_SECRET_KEY[\s\S]*JWT_SECRET/,
    );
  });

  it('refuses the default super admin password in production', () => {
    expect(() => parseEnv({ ...exampleEnv(), NODE_ENV: 'production' })).toThrow(/SUPERADMIN_PASSWORD/);
  });
});
