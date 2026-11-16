/**
 * Applies prisma/migrations/tenant to every tenant database.
 *
 *   npm run db:migrate:tenants                     (local)
 *   docker compose exec api node apps/api/dist/scripts/migrate-tenants.js   (Docker)
 *
 * Safe to re-run: Prisma records applied migrations per database. A failing
 * tenant is reported and skipped; the others still migrate. Exit code 1 if any failed.
 * Orgs still PROVISIONING or FAILED are skipped (provisioning migrates them).
 */
import { migrateTenantDb } from '../control/provisioning';
import { tenantDatabaseUrl } from '../control/tenant-url';
import { controlPrisma, disconnectControlPrisma } from '../lib/control-prisma';

const CONCURRENCY = Number(process.env.MIGRATE_CONCURRENCY ?? 4);

async function main(): Promise<void> {
  const orgs = await controlPrisma().organization.findMany({
    where: { status: { in: ['ACTIVE', 'INACTIVE'] } },
    orderBy: { createdAt: 'asc' },
  });
  console.log(`Migrating ${orgs.length} tenant database(s), ${CONCURRENCY} at a time…`);

  const failed: { slug: string; error: string }[] = [];
  let next = 0;
  const worker = async () => {
    while (next < orgs.length) {
      const org = orgs[next++];
      try {
        await migrateTenantDb(tenantDatabaseUrl(org, { pool: false }));
        console.log(`  ✓ ${org.slug} (${org.dbName})`);
      } catch (err) {
        const error = err instanceof Error ? err.message.split('\n').slice(-3).join(' ') : String(err);
        failed.push({ slug: org.slug, error });
        console.error(`  ✗ ${org.slug}: ${error}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, orgs.length) }, worker));

  console.log(`Done: ${orgs.length - failed.length} migrated, ${failed.length} failed.`);
  if (failed.length) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => disconnectControlPrisma());
