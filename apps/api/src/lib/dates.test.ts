import { describe, expect, it } from 'vitest';
import { todayInTimezone } from './dates';

describe('todayInTimezone', () => {
  it('uses the org timezone, not the server clock', () => {
    const now = new Date('2026-11-16T20:00:00Z'); // 01:30 next day in Kolkata
    expect(todayInTimezone('UTC', now).toISOString()).toBe('2026-11-16T00:00:00.000Z');
    expect(todayInTimezone('Asia/Kolkata', now).toISOString()).toBe('2026-11-17T00:00:00.000Z');
    expect(todayInTimezone('America/Los_Angeles', now).toISOString()).toBe('2026-11-16T00:00:00.000Z');
  });
});
