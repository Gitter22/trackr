import { PrismaClient } from '../generated/control';
import { env } from '../config/env';

let client: PrismaClient | undefined;

export function controlPrisma(): PrismaClient {
  if (!client) client = new PrismaClient({ datasources: { db: { url: env().CONTROL_DATABASE_URL } } });
  return client;
}

export async function disconnectControlPrisma(): Promise<void> {
  await client?.$disconnect();
  client = undefined;
}
