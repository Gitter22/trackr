import fs from 'node:fs';
import path from 'node:path';

/** Test env: .env.example values with test databases. Postgres/Redis from `npm run services:up`. */
export function testEnv(): Record<string, string> {
  const text = fs.readFileSync(path.resolve(__dirname, '../../../../.env.example'), 'utf8');
  const vars = Object.fromEntries(
    text
      .split('\n')
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
  );
  const pg = `postgresql://${vars.POSTGRES_USER}:${vars.POSTGRES_PASSWORD}@localhost:${vars.POSTGRES_PORT}`;
  return {
    ...vars,
    NODE_ENV: 'test',
    CONTROL_DATABASE_URL: `${pg}/control_test_db`,
    TENANT_DATABASE_URL: `${pg}/tenant_test_template_db`,
    REDIS_URL: 'redis://localhost:6379/15',
  };
}
