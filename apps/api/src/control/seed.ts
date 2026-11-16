import { env } from '../config/env';
import { controlPrisma } from '../lib/control-prisma';
import { hashPassword } from '../lib/password';

/** Creates the super admin from env on first start. Never overwrites an existing one. */
export async function seedSuperAdmin(): Promise<void> {
  const { SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD, SUPERADMIN_NAME } = env();
  const email = SUPERADMIN_EMAIL.toLowerCase();
  const existing = await controlPrisma().superAdmin.findUnique({ where: { email } });
  if (existing) return;
  await controlPrisma().superAdmin.create({
    data: { email, name: SUPERADMIN_NAME, passwordHash: await hashPassword(SUPERADMIN_PASSWORD) },
  });
  console.log(`Seeded super admin ${email}`);
}
