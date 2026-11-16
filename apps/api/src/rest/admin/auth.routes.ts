import { Router, type CookieOptions } from 'express';
import { z } from 'zod';
import { env } from '../../config/env';
import { controlPrisma } from '../../lib/control-prisma';
import { HttpError } from '../../lib/http';
import { ADMIN_AUDIENCE, signToken } from '../../lib/jwt';
import { verifyPassword } from '../../lib/password';
import { ADMIN_COOKIE, requireAdmin } from '../../middleware/admin-auth';

const loginSchema = z.object({ email: z.email(), password: z.string().min(1) });

/** Host-only cookie (no Domain attribute): never sent to tenant subdomains. */
export const sessionCookie = (): CookieOptions => ({
  httpOnly: true,
  sameSite: 'strict',
  secure: env().NODE_ENV === 'production',
  path: '/',
  maxAge: 12 * 60 * 60 * 1000,
});

export const adminAuthRouter = Router();

adminAuthRouter.post('/login', async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const admin = await controlPrisma().superAdmin.findUnique({ where: { email: email.toLowerCase() } });
  if (!admin || !(await verifyPassword(password, admin.passwordHash))) {
    throw new HttpError(401, 'Wrong email or password', 'BAD_CREDENTIALS');
  }
  res.cookie(ADMIN_COOKIE, signToken({ sub: admin.id }, ADMIN_AUDIENCE), sessionCookie());
  res.json({ admin: { id: admin.id, email: admin.email, name: admin.name } });
});

adminAuthRouter.post('/logout', (_req, res) => {
  res.clearCookie(ADMIN_COOKIE, { path: '/' });
  res.status(204).end();
});

adminAuthRouter.get('/me', requireAdmin, async (req, res) => {
  const admin = await controlPrisma().superAdmin.findUnique({ where: { id: req.adminId } });
  if (!admin) throw new HttpError(401, 'Not signed in', 'UNAUTHENTICATED');
  res.json({ admin: { id: admin.id, email: admin.email, name: admin.name } });
});
