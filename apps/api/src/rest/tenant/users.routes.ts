import { Router } from 'express';
import { z } from 'zod';
import { env } from '../../config/env';
import { HttpError, notFound } from '../../lib/http';
import { hashPassword } from '../../lib/password';
import { assertCan } from '../../policy/policy';
import { publicUser } from './auth.routes';

/** OWNER is only ever set by provisioning; it can't be granted here. */
const assignableRole = z.enum(['ADMIN', 'MEMBER', 'VIEWER']);

const createUserSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.email().transform((e) => e.toLowerCase()),
  role: assignableRole,
});

const updateUserSchema = z
  .object({ name: z.string().trim().min(1).max(100), role: assignableRole, isActive: z.boolean() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'Nothing to update');

export const tenantUsersRouter = Router();

tenantUsersRouter.get('/', async (req, res) => {
  assertCan(req.user!, 'user', 'view');
  const users = await req.prisma!.user.findMany({ orderBy: [{ isActive: 'desc' }, { name: 'asc' }] });
  res.json({ users: users.map(publicUser) });
});

/** New users sign in with USER_DEFAULT_PASSWORD. */
tenantUsersRouter.post('/', async (req, res) => {
  assertCan(req.user!, 'user', 'create');
  const input = createUserSchema.parse(req.body);
  const user = await req.prisma!.user.create({
    data: { ...input, passwordHash: await hashPassword(env().USER_DEFAULT_PASSWORD) },
  });
  res.status(201).json({ user: publicUser(user) });
});

tenantUsersRouter.patch('/:id', async (req, res) => {
  const input = updateUserSchema.parse(req.body);
  const db = req.prisma!;
  const target = await db.user.findUnique({ where: { id: req.params.id } });
  if (!target) throw notFound('User not found');

  const actor = req.user!;
  if (input.name !== undefined) assertCan(actor, 'user', 'edit');
  if (input.role !== undefined) assertCan(actor, 'user', 'changeRole', { targetRole: target.role });
  if (input.isActive !== undefined) assertCan(actor, 'user', 'activate', { targetRole: target.role });
  if (target.id === actor.id && (input.role !== undefined || input.isActive !== undefined)) {
    throw new HttpError(400, "You can't change your own role or status", 'VALIDATION');
  }

  // Role or status change ends the user's existing sessions.
  const endsSessions =
    (input.role !== undefined && input.role !== target.role) ||
    (input.isActive !== undefined && input.isActive !== target.isActive);
  const user = await db.user.update({
    where: { id: target.id },
    data: { ...input, ...(endsSessions ? { tokenVersion: { increment: 1 } } : {}) },
  });
  res.json({ user: publicUser(user) });
});
