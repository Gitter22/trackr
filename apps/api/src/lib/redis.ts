import Redis from 'ioredis';
import { env } from '../config/env';

let client: Redis | undefined;

export function redis(): Redis {
  if (!client) client = new Redis(env().REDIS_URL, { maxRetriesPerRequest: 2 });
  return client;
}

export async function disconnectRedis(): Promise<void> {
  await client?.quit();
  client = undefined;
}
