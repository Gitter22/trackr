/**
 * Fractional ordering for statuses (step 100) and task ranks (step 1000).
 * Insert between two neighbours with their midpoint; when the gap gets too small
 * for floats to split, the caller renumbers the whole list.
 */
export const MIN_GAP = 1e-6;

/** Position between `before` (above) and `after` (below). Either may be missing (list end). */
export function between(
  before: number | null | undefined,
  after: number | null | undefined,
  step: number,
): number {
  const hasBefore = before !== null && before !== undefined;
  const hasAfter = after !== null && after !== undefined;
  if (hasBefore && hasAfter) return (before + after) / 2;
  if (hasBefore) return before + step;
  if (hasAfter) return after - step;
  return step;
}

/** True when the new value is too close to a neighbour, so the list should be renumbered. */
export function needsRebalance(value: number, before?: number | null, after?: number | null): boolean {
  return (
    (before !== null && before !== undefined && value - before < MIN_GAP) ||
    (after !== null && after !== undefined && after - value < MIN_GAP)
  );
}

/** Evenly spaced values for `count` items: step, 2*step, ... */
export const evenlySpaced = (count: number, step: number) =>
  Array.from({ length: count }, (_, i) => (i + 1) * step);

export interface Positioned {
  id: string;
  position: number;
}

/**
 * Where to put an item in an ordered list (the item itself already removed).
 * `afterId` = the item it should follow, `beforeId` = the item it should precede.
 * afterId wins if both are given; neither means the end of the list.
 * Neighbours come from the list, so a stale client view can't break the order.
 */
export function placeInList(
  list: Positioned[],
  anchor: { afterId?: string | null; beforeId?: string | null },
  step: number,
): { index: number; value: number; rebalance: boolean } | null {
  let index: number;
  if (anchor.afterId) {
    const i = list.findIndex((x) => x.id === anchor.afterId);
    if (i < 0) return null;
    index = i + 1;
  } else if (anchor.beforeId) {
    const i = list.findIndex((x) => x.id === anchor.beforeId);
    if (i < 0) return null;
    index = i;
  } else {
    index = list.length;
  }
  const prev = list[index - 1]?.position;
  const next = list[index]?.position;
  const value = between(prev, next, step);
  return { index, value, rebalance: needsRebalance(value, prev, next) };
}
