import { Router } from 'express';
import { z } from 'zod';
import type { Organization, User } from '../../generated/control';
import { provisionOrganization } from '../../control/provisioning';
import { invalidateTenantCache } from '../../control/tenant-cache';
import { isValidTimezone, slugSchema, tenantDbNames } from '../../control/tenant-names';
import { controlPrisma } from '../../lib/control-prisma';
import { HttpError, notFound } from '../../lib/http';

const createOrgSchema = z.object({
  title: z.string().trim().min(1).max(100),
  slug: slugSchema,
  ownerId: z.uuid(),
  projectLimit: z.coerce.number().int().min(1).max(1000),
  timezone: z.string().refine(isValidTimezone, 'Unknown timezone'),
});

const statusSchema = z.object({ status: z.enum(['ACTIVE', 'INACTIVE']) });

/** Never expose DB credentials. */
function publicOrg(org: Organization & { owner?: User }) {
  const { dbPasswordEnc: _p, dbUser: _u, ...rest } = org;
  return rest;
}

export const adminOrgsRouter = Router();

adminOrgsRouter.get('/', async (_req, res) => {
  const orgs = await controlPrisma().organization.findMany({
    orderBy: { createdAt: 'desc' },
    include: { owner: true },
  });
  res.json({ organizations: orgs.map(publicOrg) });
});

adminOrgsRouter.post('/', async (req, res) => {
  const input = createOrgSchema.parse(req.body);
  const db = controlPrisma();
  if (!(await db.user.findUnique({ where: { id: input.ownerId } }))) {
    throw new HttpError(400, 'Owner not found', 'VALIDATION');
  }
  const org = await db.organization.create({
    data: { ...input, ...tenantDbNames(input.slug), dbPasswordEnc: '', status: 'PROVISIONING' },
  });
  // Takes a few seconds; the UI shows PROVISIONING until this returns.
  const result = await provisionOrganization(org.id);
  res.status(201).json({
    organization: publicOrg(
      await db.organization.findUniqueOrThrow({ where: { id: result.id }, include: { owner: true } }),
    ),
  });
});

/** Re-run provisioning for a FAILED org. */
adminOrgsRouter.post('/:id/retry', async (req, res) => {
  const org = await controlPrisma().organization.findUnique({ where: { id: req.params.id } });
  if (!org) throw notFound('Organization not found');
  if (org.status !== 'FAILED')
    throw new HttpError(409, 'Only failed organizations can be retried', 'CONFLICT');
  res.json({ organization: publicOrg(await provisionOrganization(org.id)) });
});

adminOrgsRouter.patch('/:id/status', async (req, res) => {
  const { status } = statusSchema.parse(req.body);
  const db = controlPrisma();
  const org = await db.organization.findUnique({ where: { id: req.params.id } });
  if (!org) throw notFound('Organization not found');
  if (org.status !== 'ACTIVE' && org.status !== 'INACTIVE') {
    throw new HttpError(409, `Cannot change status while ${org.status}`, 'CONFLICT');
  }
  const updated = await db.organization.update({
    where: { id: org.id },
    data: { status },
    include: { owner: true },
  });
  await invalidateTenantCache(org.slug);
  res.json({ organization: publicOrg(updated) });
});
