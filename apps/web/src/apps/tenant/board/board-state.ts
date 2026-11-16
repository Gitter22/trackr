import type { InfiniteData } from '@tanstack/react-query';
import type { BoardColumnQuery } from '@/api/generated/graphql';

export type ColumnPage = BoardColumnQuery['tasks'];
export type Card = ColumnPage['edges'][number]['node'];
export type ColumnData = InfiniteData<ColumnPage, unknown>;

export const cardsOf = (data: ColumnData | undefined): Card[] =>
  data?.pages.flatMap((p) => p.edges.map((e) => e.node)) ?? [];

export interface MovePlan {
  /** Target column order after the drop. */
  order: Card[];
  /** Card directly above the dropped card (server anchor). */
  afterTaskId: string | null;
  /** Card directly below the dropped card. */
  beforeTaskId: string | null;
}

/**
 * Where a dragged card lands. `overId` is the card it was dropped on (it takes
 * that card's place) or null when dropped on the column itself (goes to the end).
 * Returns null when nothing changes.
 */
export function planMove(
  card: Card,
  source: Card[],
  target: Card[],
  overId: string | null,
  sameColumn: boolean,
): MovePlan | null {
  let order: Card[];
  if (sameColumn) {
    const from = source.findIndex((c) => c.id === card.id);
    const to = overId ? source.findIndex((c) => c.id === overId) : source.length - 1;
    if (from < 0 || to < 0 || from === to) return null;
    order = [...source];
    order.splice(from, 1);
    order.splice(to, 0, card);
  } else {
    const at = overId ? target.findIndex((c) => c.id === overId) : -1;
    order = [...target];
    order.splice(at < 0 ? order.length : at, 0, card);
  }
  const i = order.findIndex((c) => c.id === card.id);
  return { order, afterTaskId: order[i - 1]?.id ?? null, beforeTaskId: order[i + 1]?.id ?? null };
}

/** Removes a card from a column's cached pages. */
export function withoutCard(data: ColumnData | undefined, id: string): ColumnData | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((p) => {
      const edges = p.edges.filter((e) => e.node.id !== id);
      return edges.length === p.edges.length ? p : { ...p, edges, totalCount: p.totalCount - 1 };
    }),
  };
}

/** Rebuilds a column's cached pages in the given order (page sizes kept, last page grows). */
export function withOrder(data: ColumnData | undefined, order: Card[]): ColumnData | undefined {
  if (!data) return data;
  const cursors = new Map(data.pages.flatMap((p) => p.edges.map((e) => [e.node.id, e.cursor] as const)));
  let i = 0;
  const pages = data.pages.map((p, pageIndex) => {
    const size = pageIndex === data.pages.length - 1 ? order.length - i : p.edges.length;
    const edges = order.slice(i, i + size).map((node) => ({ cursor: cursors.get(node.id) ?? node.id, node }));
    i += size;
    return { ...p, edges, totalCount: order.length };
  });
  return { ...data, pages };
}
