import { Router } from 'express';
import { z } from 'zod';
import type { User } from '../../generated/tenant';
import { HttpError } from '../../lib/http';
import { signToken, tenantAudience } from '../../lib/jwt';
import { verifyPassword } from '../../lib/password';
import { requireTenantUser } from '../../middleware/tenant-auth';

const loginSchema = z.object({ email: z.email(), password: z.string().min(1) });

export const publicUser = (u: User) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
  isActive: u.isActive,
});

export const tenantAuthRouter = Router();

tenantAuthRouter.post('/login', async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const user = await req.prisma!.user.findUnique({ where: { email: email.toLowerCase() } });
  // Same message for unknown user, wrong password and inactive user: don't reveal which.
  if (!user || !user.isActive || !(await verifyPassword(password, user.passwordHash))) {
    throw new HttpError(401, 'Wrong email or password', 'BAD_CREDENTIALS');
  }
  const token = signToken({ sub: user.id, ver: user.tokenVersion }, tenantAudience(req.tenant!.slug));
  res.json({ token, user: publicUser(user) });
});

tenantAuthRouter.get('/me', requireTenantUser, (req, res) => {
  const t = req.tenant!;
  res.json({ user: publicUser(req.user!), org: { slug: t.slug, title: t.title, timezone: t.timezone } });
});
