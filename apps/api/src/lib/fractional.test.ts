import { describe, expect, it } from 'vitest';
import { between, evenlySpaced, needsRebalance, placeInList } from './fractional';

describe('fractional ordering', () => {
  it('places items between, before, after, or first', () => {
    expect(between(100, 200, 100)).toBe(150);
    expect(between(300, null, 100)).toBe(400);
    expect(between(null, 100, 100)).toBe(0);
    expect(between(undefined, undefined, 1000)).toBe(1000);
  });

  it('flags when repeated halving runs out of room', () => {
    let lo = 1000;
    const hi = 2000;
    let steps = 0;
    while (!needsRebalance(between(lo, hi, 1000), lo, hi)) {
      lo = between(lo, hi, 1000);
      steps++;
    }
    expect(steps).toBeGreaterThan(20);
    expect(steps).toBeLessThan(60);
  });

  it('renumbers evenly', () => {
    expect(evenlySpaced(3, 100)).toEqual([100, 200, 300]);
  });
});

describe('placeInList', () => {
  const list = [
    { id: 'a', position: 100 },
    { id: 'b', position: 200 },
    { id: 'c', position: 300 },
  ];
  it('places after, before, at the end, and reports unknown anchors', () => {
    expect(placeInList(list, { afterId: 'a' }, 100)).toEqual({ index: 1, value: 150, rebalance: false });
    expect(placeInList(list, { beforeId: 'a' }, 100)).toEqual({ index: 0, value: 0, rebalance: false });
    expect(placeInList(list, {}, 100)).toEqual({ index: 3, value: 400, rebalance: false });
    expect(placeInList(list, { afterId: 'zzz' }, 100)).toBeNull();
  });
  it('asks for a rebalance when neighbours are too close', () => {
    const tight = [
      { id: 'a', position: 1 },
      { id: 'b', position: 1 + 1e-7 },
    ];
    expect(placeInList(tight, { afterId: 'a' }, 100)?.rebalance).toBe(true);
  });
});
