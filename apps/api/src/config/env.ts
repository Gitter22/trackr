import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

/**
 * Loads the root .env.local when running outside Docker. In Docker, compose
 * injects the same values, and already-set variables are never overwritten.
 */
function loadRootEnvFile(): void {
  const file = path.resolve(__dirname, '../../../../.env.local');
  if (process.env.NODE_ENV !== 'test' && fs.existsSync(file)) process.loadEnvFile(file);
}

const posInt = (def: number) => z.coerce.number().int().positive().default(def);

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_DOMAIN: z.string().min(1).default('trcker.localhost'),
  API_PORT: posInt(4000),
  PROXY_SECRET: z.string().min(8),

  POSTGRES_HOST: z.string().default('localhost'),
  POSTGRES_PORT: posInt(5432),
  POSTGRES_USER: z.string().min(1),
  POSTGRES_PASSWORD: z.string().min(1),
  CONTROL_DATABASE_URL: z.url(),
  TENANT_DB_CONNECTION_LIMIT: posInt(5),
  TENANT_CLIENT_CACHE_MAX: posInt(50),
  TENANT_DB_SECRET_KEY: z.string().regex(/^[0-9a-f]{64}$/i, 'must be 32 bytes hex (64 chars)'),

  REDIS_URL: z.string().min(1),
  TENANT_CACHE_TTL_SECONDS: posInt(60),
  RATE_LIMIT_CAPACITY: posInt(100),
  RATE_LIMIT_REFILL_PER_SEC: posInt(20),

  JWT_SECRET: z.string().min(32),
  JWT_TTL: z.string().default('12h'),

  SUPERADMIN_EMAIL: z.email(),
  SUPERADMIN_PASSWORD: z.string().min(6),
  SUPERADMIN_NAME: z.string().default('Super Admin'),
  ORG_OWNER_DEFAULT_PASSWORD: z.string().min(6),
  USER_DEFAULT_PASSWORD: z.string().min(6),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment:\n${lines.join('\n')}`);
  }
  const env = result.data;
  if (env.NODE_ENV === 'production' && env.SUPERADMIN_PASSWORD === 'Test@123') {
    throw new Error('SUPERADMIN_PASSWORD must be changed in production');
  }
  return env;
}

let cached: Env | undefined;
export function env(): Env {
  if (!cached) {
    loadRootEnvFile();
    cached = parseEnv(process.env);
  }
  return cached;
}
