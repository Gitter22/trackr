import { describe, expect, it } from 'vitest';
import { describeActivity } from './activity';
import { cardsOf, planMove, withOrder, withoutCard, type Card, type ColumnData } from './board-state';
import { EMPTY_FILTERS, readFilters, toTaskFilter, writeFilters } from './filters';
import { tileNumbers } from './Summary';

const card = (id: string): Card => ({
  id,
  key: `KIK-${id}`,
  title: id,
  priority: 'MEDIUM',
  dueDate: null,
  isOverdue: false,
  rank: 0,
  commentCount: 0,
  status: { id: 's' },
  assignees: [],
  labels: [],
});
const ids = (cs: Card[]) => cs.map((c) => c.id);
const [a, b, c, d] = ['a', 'b', 'c', 'd'].map(card);

describe('planMove', () => {
  it('reorders within a column and gives the server its neighbours', () => {
    const plan = planMove(a, [a, b, c], [a, b, c], 'c', true)!;
    expect(ids(plan.order)).toEqual(['b', 'c', 'a']);
    expect(plan).toMatchObject({ afterTaskId: 'c', beforeTaskId: null });
  });

  it('drops onto a card in another column (takes its place)', () => {
    const plan = planMove(d, [d], [a, b, c], 'b', false)!;
    expect(ids(plan.order)).toEqual(['a', 'd', 'b', 'c']);
    expect(plan).toMatchObject({ afterTaskId: 'a', beforeTaskId: 'b' });
  });

  it('drops on an empty column or its empty space (goes to the end)', () => {
    expect(planMove(d, [d], [], null, false)).toEqual({ order: [d], afterTaskId: null, beforeTaskId: null });
    expect(planMove(d, [d], [a], null, false)).toMatchObject({ afterTaskId: 'a', beforeTaskId: null });
  });

  it('returns null when a card is dropped on itself', () => {
    expect(planMove(a, [a, b], [a, b], 'a', true)).toBeNull();
  });
});

describe('cache helpers', () => {
  const page = (cards: Card[], total: number) => ({
    totalCount: total,
    edges: cards.map((n) => ({ cursor: `cur-${n.id}`, node: n })),
    pageInfo: { hasNextPage: false, endCursor: null },
  });
  const data: ColumnData = { pages: [page([a, b], 3), page([c], 3)], pageParams: [null, 'x'] };

  it('removes a card from whichever page holds it', () => {
    const next = withoutCard(data, 'c')!;
    expect(ids(cardsOf(next))).toEqual(['a', 'b']);
    expect(next.pages[1].totalCount).toBe(2);
  });

  it('rewrites pages in a new order, keeping cursors and page sizes', () => {
    const next = withOrder(data, [c, a, b, d])!;
    expect(next.pages.map((p) => ids(p.edges.map((e) => e.node)))).toEqual([
      ['c', 'a'],
      ['b', 'd'],
    ]);
    expect(next.pages[0].edges[0].cursor).toBe('cur-c');
  });
});

describe('filters', () => {
  it('round-trips through the URL and keeps other params', () => {
    const f = {
      ...EMPTY_FILTERS,
      search: 'login',
      assigneeId: '2f022638-460e-43d1-9566-ee220d6292e7',
      priority: 'HIGH' as const,
      dueFrom: '2026-11-01',
      overdue: true,
    };
    const params = writeFilters(new URLSearchParams('task=t1'), f);
    expect(params.get('task')).toBe('t1');
    expect(readFilters(params)).toEqual(f);
    expect(writeFilters(params, EMPTY_FILTERS).toString()).toBe('task=t1');
  });

  it('builds the API filter (status is applied by hiding columns)', () => {
    expect(
      toTaskFilter({
        ...EMPTY_FILTERS,
        statusId: 's1',
        priority: 'LOW',
        dueTo: '2026-12-31',
        search: '  KIK-2 ',
      }),
    ).toEqual({
      priorities: ['LOW'],
      due: { from: null, to: '2026-12-31' },
      search: 'KIK-2',
    });
    expect(toTaskFilter(EMPTY_FILTERS)).toEqual({});
  });

  it('ignores malformed values from hand-edited URLs', () => {
    const f = readFilters(new URLSearchParams('priority=URGENT&assignee=garbage&status=1&from=yesterday'));
    expect(f).toEqual(EMPTY_FILTERS);
  });
});

describe('describeActivity', () => {
  it.each([
    [{ type: 'CREATED', field: null, fromValue: null, toValue: null }, 'created this task'],
    [
      { type: 'STATUS_CHANGED', field: 'status', fromValue: { name: 'To Do' }, toValue: { name: 'Done' } },
      'moved this from To Do to Done',
    ],
    [
      { type: 'UPDATED', field: 'priority', fromValue: 'MEDIUM', toValue: 'HIGH' },
      'changed priority from Medium to High',
    ],
    [
      { type: 'UPDATED', field: 'dueDate', fromValue: null, toValue: '2026-12-01' },
      'changed due date from none to 2026-12-01',
    ],
    [
      { type: 'ASSIGNEE_ADDED', field: 'assignees', fromValue: null, toValue: { name: 'Mary' } },
      'assigned Mary',
    ],
    [{ type: 'COMMENTED', field: null, fromValue: null, toValue: { reply: true } }, 'replied to a comment'],
  ] as const)('%o', (activity, text) => {
    expect(describeActivity(activity as never)).toBe(text);
  });
});

describe('tileNumbers', () => {
  it('derives open, done and done share (cancelled excluded)', () => {
    const n = tileNumbers({
      total: 10,
      overdueCount: 2,
      byStatus: [],
      byAssignee: [],
      byCategory: [
        { category: 'NOT_STARTED', count: 3 },
        { category: 'STARTED', count: 2 },
        { category: 'COMPLETED', count: 3 },
        { category: 'CANCELLED', count: 2 },
      ],
    });
    expect(n).toEqual({ total: 10, open: 5, done: 3, doneShare: 38, overdue: 2 });
  });
});
