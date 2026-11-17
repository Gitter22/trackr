import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../..');

function readEnvFile(name: string): Record<string, string> {
  const file = path.join(ROOT, name);
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(file, 'utf8')
      .split('\n')
      .filter((l) => l && !l.startsWith('#') && l.includes('='))
      .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
  );
}

/**
 * Test env: .env.example values with test databases. Postgres/Redis from `npm run services:up`.
 * Connection settings come from .env.local when it exists, so tests reach the same
 * Docker services as `npm run dev` (e.g. on 5433/6380 next to a local Postgres/Redis).
 */
export function testEnv(): Record<string, string> {
  const local = readEnvFile('.env.local');
  const vars = { ...readEnvFile('.env.example') };
  for (const key of ['POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_PORT', 'REDIS_PORT']) {
    if (local[key]) vars[key] = local[key];
  }
  const pg = `postgresql://${vars.POSTGRES_USER}:${vars.POSTGRES_PASSWORD}@localhost:${vars.POSTGRES_PORT}`;
  return {
    ...vars,
    NODE_ENV: 'test',
    CONTROL_DATABASE_URL: `${pg}/control_test_db`,
    TENANT_DATABASE_URL: `${pg}/tenant_test_template_db`,
    REDIS_URL: `redis://localhost:${vars.REDIS_PORT ?? 6379}/15`,
    // Tests fire hundreds of requests per tenant; the limiter has its own tests.
    RATE_LIMIT_CAPACITY: '100000',
  };
}
