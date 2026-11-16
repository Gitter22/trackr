import express from 'express';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { errorHandler } from '../lib/http';
import { disconnectRedis, redis } from '../lib/redis';
import { rateLimit, takeToken } from './rate-limit';

beforeEach(async () => {
  await redis().flushdb();
});
afterAll(disconnectRedis);

describe('token bucket', () => {
  it('allows up to capacity, then refills over time', async () => {
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await takeToken(redis(), 'rl:test', 3, 5));
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results[3].retryAfterMs).toBeGreaterThan(0);
    await new Promise((r) => setTimeout(r, 250)); // 5/s -> at least one token back
    expect((await takeToken(redis(), 'rl:test', 3, 5)).allowed).toBe(true);
  });

  it('keeps tenants independent and answers 429 with Retry-After', async () => {
    const app = express();
    app.use(
      rateLimit({ redis, capacity: 2, refillPerSec: 1, keyOf: (req) => String(req.get('x-tenant-slug')) }),
    );
    app.get('/', (_req, res) => {
      res.send('ok');
    });
    app.use(errorHandler);
    const hit = (slug: string) => request(app).get('/').set('X-Tenant-Slug', slug);
    expect((await hit('a')).status).toBe(200);
    expect((await hit('a')).status).toBe(200);
    const limited = await hit('a');
    expect(limited.status).toBe(429);
    expect(limited.headers['retry-after']).toBe('1');
    expect((await hit('b')).status).toBe(200);
  });
});
