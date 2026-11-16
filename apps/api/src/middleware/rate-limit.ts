import type { RequestHandler } from 'express';
import type Redis from 'ioredis';
import { HttpError } from '../lib/http';

/**
 * Token bucket in one atomic Lua call. Each tenant has `capacity` tokens that
 * refill at `refillPerSec`; a request takes one. Uses Redis time so every API
 * instance agrees on the clock.
 * Returns { allowed (0/1), retryAfterMs }.
 */
const TOKEN_BUCKET_LUA = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local rate = tonumber(ARGV[2])
local t = redis.call('TIME')
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
local data = redis.call('HMGET', key, 'tokens', 'ts')
local tokens = tonumber(data[1]) or capacity
local ts = tonumber(data[2]) or now
tokens = math.min(capacity, tokens + (now - ts) / 1000 * rate)
local allowed = 0
local retry = 0
if tokens >= 1 then
  tokens = tokens - 1
  allowed = 1
else
  retry = math.ceil((1 - tokens) / rate * 1000)
end
redis.call('HSET', key, 'tokens', tokens, 'ts', now)
redis.call('PEXPIRE', key, math.ceil(capacity / rate * 1000) + 1000)
return { allowed, retry }
`;

export interface RateLimitOptions {
  redis: () => Redis;
  capacity: number;
  refillPerSec: number;
  /** Bucket key for the request, e.g. the tenant slug. */
  keyOf: (req: Parameters<RequestHandler>[0]) => string;
}

export async function takeToken(
  client: Redis,
  key: string,
  capacity: number,
  refillPerSec: number,
): Promise<{ allowed: boolean; retryAfterMs: number }> {
  const [allowed, retry] = (await client.eval(TOKEN_BUCKET_LUA, 1, key, capacity, refillPerSec)) as [
    number,
    number,
  ];
  return { allowed: allowed === 1, retryAfterMs: retry };
}

export function rateLimit(opts: RateLimitOptions): RequestHandler {
  return async (req, res, next) => {
    const { allowed, retryAfterMs } = await takeToken(
      opts.redis(),
      `rl:${opts.keyOf(req)}`,
      opts.capacity,
      opts.refillPerSec,
    );
    if (!allowed) {
      res.setHeader('Retry-After', Math.max(1, Math.ceil(retryAfterMs / 1000)));
      throw new HttpError(429, 'Too many requests, slow down', 'RATE_LIMITED');
    }
    next();
  };
}
