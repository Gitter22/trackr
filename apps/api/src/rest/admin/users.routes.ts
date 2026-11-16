import { Router } from 'express';
import { z } from 'zod';
import { controlPrisma } from '../../lib/control-prisma';

/** Org owners. They get ORG_OWNER_DEFAULT_PASSWORD when an org is provisioned for them. */
const createUserSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.email().transform((e) => e.toLowerCase()),
});

export const adminUsersRouter = Router();

adminUsersRouter.get('/', async (_req, res) => {
  const users = await controlPrisma().user.findMany({
    orderBy: { createdAt: 'desc' },
    include: { organizations: { select: { id: true, slug: true, title: true, status: true } } },
  });
  res.json({ users });
});

adminUsersRouter.post('/', async (req, res) => {
  const data = createUserSchema.parse(req.body);
  const user = await controlPrisma().user.create({ data });
  res.status(201).json({ user });
});
