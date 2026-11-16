import path from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: path.join(__dirname, 'tenant.prisma'),
  migrations: { path: path.join(__dirname, 'migrations/tenant') },
});
