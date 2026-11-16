import { execSync } from 'node:child_process';
import path from 'node:path';
import { PrismaClient } from '../generated/control';
import { testEnv } from './env';

/** Recreates the control test DB and applies control migrations once per test run. */
export default async function setup(): Promise<void> {
  const env = { ...process.env, ...testEnv() };
  const url = env.CONTROL_DATABASE_URL!;
  const db = new PrismaClient({ datasources: { db: { url: url.replace(/\/[^/]+$/, '/postgres') } } });
  // Drop leftover tenant test DBs and roles from earlier runs too.
  const leftovers = await db.$queryRawUnsafe<{ datname: string }[]>(
    `SELECT datname FROM pg_database WHERE datname = 'control_test_db' OR datname LIKE 'tenant\\_t\\_%'`,
  );
  for (const { datname } of leftovers) await db.$executeRawUnsafe(`DROP DATABASE "${datname}" WITH (FORCE)`);
  const roles = await db.$queryRawUnsafe<{ rolname: string }[]>(
    `SELECT rolname FROM pg_roles WHERE rolname LIKE 'tenant\\_t\\_%'`,
  );
  for (const { rolname } of roles) await db.$executeRawUnsafe(`DROP ROLE "${rolname}"`);
  await db.$executeRawUnsafe('CREATE DATABASE control_test_db');
  await db.$disconnect();
  const root = path.resolve(__dirname, '../../../..');
  execSync('npx prisma migrate deploy --config prisma/control.config.ts', { cwd: root, env, stdio: 'pipe' });
}
