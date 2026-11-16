import { createApp } from './app';
import { env } from './config/env';
import { seedSuperAdmin } from './control/seed';
import { disconnectControlPrisma } from './lib/control-prisma';
import { disconnectRedis } from './lib/redis';
import type { TenantClientPool } from './tenant/tenant-pool';

async function main(): Promise<void> {
  const { API_PORT } = env();
  await seedSuperAdmin();
  const app = createApp();
  const server = app.listen(API_PORT, () => {
    console.log(`API listening on :${API_PORT}`);
  });

  const shutdown = () => {
    server.close(async () => {
      await (app.locals.pool as TenantClientPool).clear();
      await disconnectControlPrisma();
      await disconnectRedis();
      process.exit(0);
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
