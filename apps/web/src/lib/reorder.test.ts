import { describe, expect, it } from 'vitest';
import { reorder } from './reorder';

describe('reorder', () => {
  const ids = ['a', 'b', 'c', 'd'];
  it('moves down and reports neighbours', () => {
    expect(reorder(ids, 'a', 'c')).toEqual({ order: ['b', 'c', 'a', 'd'], afterId: 'c', beforeId: 'd' });
  });
  it('moves up to the top', () => {
    expect(reorder(ids, 'd', 'a')).toEqual({ order: ['d', 'a', 'b', 'c'], afterId: null, beforeId: 'a' });
  });
  it('moves to the bottom', () => {
    expect(reorder(ids, 'b', 'd')).toEqual({ order: ['a', 'c', 'd', 'b'], afterId: 'd', beforeId: null });
  });
  it('ignores no-op and unknown ids', () => {
    expect(reorder(ids, 'a', 'a')).toBeNull();
    expect(reorder(ids, 'x', 'a')).toBeNull();
  });
});
