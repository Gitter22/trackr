import { createApp } from './app';
import { env } from './config/env';
import { seedSuperAdmin } from './control/seed';

async function main(): Promise<void> {
  const { API_PORT } = env();
  await seedSuperAdmin();
  createApp().listen(API_PORT, () => {
    console.log(`API listening on :${API_PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
