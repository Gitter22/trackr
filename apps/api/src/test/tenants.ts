import { provisionOrganization } from '../control/provisioning';
import { tenantDbNames } from '../control/tenant-names';
import { controlPrisma } from '../lib/control-prisma';

/** Provisions a real tenant DB for tests. Slugs must start with "t-" (cleaned up by global setup). */
export async function provisionTestTenant(slug: string, opts: { projectLimit?: number } = {}) {
  const ownerEmail = `owner@${slug}.test`;
  if (!slug.startsWith('t-')) throw new Error('test tenant slugs must start with t-');
  const db = controlPrisma();
  const owner = await db.user.upsert({
    where: { email: ownerEmail },
    update: {},
    create: { name: 'Owner', email: ownerEmail },
  });
  const existing = await db.organization.findUnique({ where: { slug } });
  if (existing) return existing;
  const org = await db.organization.create({
    data: {
      title: `Org ${slug}`,
      slug,
      ownerId: owner.id,
      projectLimit: opts.projectLimit ?? 5,
      timezone: 'UTC',
      dbPasswordEnc: '',
      ...tenantDbNames(slug),
    },
  });
  const result = await provisionOrganization(org.id);
  if (result.status !== 'ACTIVE') throw new Error(`provisioning failed: ${result.provisionError}`);
  return result;
}
