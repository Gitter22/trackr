import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import path from 'node:path';
import { promisify } from 'node:util';
import { env } from '../config/env';
import type { Organization } from '../generated/control';
import { PrismaClient as TenantPrismaClient } from '../generated/tenant';
import { controlPrisma } from '../lib/control-prisma';
import { encrypt } from '../lib/crypto';
import { hashPassword } from '../lib/password';
import { invalidateTenantCache } from './tenant-cache';
import { tenantDatabaseUrl } from './tenant-url';

const run = promisify(execFile);
const REPO_ROOT = path.resolve(__dirname, '../../../..');
const PRISMA_CLI = require.resolve('prisma/build/index.js');

const IDENT = /^[a-z0-9_]+$/;
function ident(name: string): string {
  if (!IDENT.test(name)) throw new Error(`Unsafe identifier: ${name}`);
  return `"${name}"`;
}

/** Applies prisma/migrations/tenant to one tenant DB. Safe to re-run. */
export async function migrateTenantDb(databaseUrl: string): Promise<void> {
  await run(process.execPath, [PRISMA_CLI, 'migrate', 'deploy', '--config', 'prisma/tenant.config.ts'], {
    cwd: REPO_ROOT,
    env: { ...process.env, TENANT_DATABASE_URL: databaseUrl },
  });
}

/**
 * Creates the tenant's role and database, applies the tenant schema, seeds the
 * owner and settings, then marks the org ACTIVE. Every step is idempotent, so a
 * FAILED org can simply be provisioned again.
 */
export async function provisionOrganization(orgId: string): Promise<Organization> {
  const db = controlPrisma();
  const org = await db.organization.findUniqueOrThrow({ where: { id: orgId }, include: { owner: true } });
  await db.organization.update({
    where: { id: orgId },
    data: { status: 'PROVISIONING', provisionError: null },
  });

  try {
    // 1. Role with a fresh password (stored encrypted). ALTER keeps retries working.
    const password = crypto.randomBytes(24).toString('hex');
    const role = ident(org.dbUser);
    const roleExists = await db.$queryRawUnsafe<unknown[]>(
      `SELECT 1 FROM pg_roles WHERE rolname = $1`,
      org.dbUser,
    );
    await db.$executeRawUnsafe(
      `${roleExists.length ? 'ALTER' : 'CREATE'} ROLE ${role} WITH LOGIN PASSWORD '${password}'`,
    );
    const dbPasswordEnc = encrypt(password);
    await db.organization.update({ where: { id: orgId }, data: { dbPasswordEnc } });

    // 2. Database owned by that role; nobody else may connect.
    const dbExists = await db.$queryRawUnsafe<unknown[]>(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      org.dbName,
    );
    if (!dbExists.length) await db.$executeRawUnsafe(`CREATE DATABASE ${ident(org.dbName)} OWNER ${role}`);
    await db.$executeRawUnsafe(`REVOKE ALL ON DATABASE ${ident(org.dbName)} FROM PUBLIC`);

    // 3. Schema
    const ref = { dbName: org.dbName, dbUser: org.dbUser, dbPasswordEnc };
    await migrateTenantDb(tenantDatabaseUrl(ref, { pool: false }));

    // 4. Owner + workspace settings
    const tenant = new TenantPrismaClient({ datasources: { db: { url: tenantDatabaseUrl(ref) } } });
    try {
      const email = org.owner.email.toLowerCase();
      await tenant.user.upsert({
        where: { email },
        update: { role: 'OWNER', isActive: true },
        create: {
          email,
          name: org.owner.name,
          role: 'OWNER',
          passwordHash: await hashPassword(env().ORG_OWNER_DEFAULT_PASSWORD),
        },
      });
      for (const [key, value] of Object.entries({
        timezone: org.timezone,
        projectLimit: org.projectLimit,
        title: org.title,
      })) {
        await tenant.orgSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
      }
    } finally {
      await tenant.$disconnect();
    }

    // 5. Done
    const active = await db.organization.update({ where: { id: orgId }, data: { status: 'ACTIVE' } });
    await invalidateTenantCache(org.slug);
    return active;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return db.organization.update({
      where: { id: orgId },
      data: { status: 'FAILED', provisionError: message.slice(0, 2000) },
    });
  }
}
