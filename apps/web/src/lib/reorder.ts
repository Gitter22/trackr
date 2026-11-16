/**
 * Moves `activeId` to where `overId` is and returns the new order plus the
 * neighbours the server needs (fractional ordering): the item now above
 * (afterId) and below (beforeId) the moved one.
 */
export function reorder(ids: string[], activeId: string, overId: string) {
  const from = ids.indexOf(activeId);
  const to = ids.indexOf(overId);
  if (from < 0 || to < 0 || from === to) return null;
  const order = [...ids];
  order.splice(from, 1);
  order.splice(to, 0, activeId);
  return { order, afterId: order[to - 1] ?? null, beforeId: order[to + 1] ?? null };
}
