import type { Prisma } from '../generated/tenant';
import type { TaskFilter } from './__generated__/resolvers-types';
import { badInput } from './errors';

export const MAX_PAGE = 100;
export const CLOSED_CATEGORIES = ['COMPLETED', 'CANCELLED'] as const;

/** Cursor = base64("rank:id"). Opaque to clients. */
export const encodeCursor = (t: { rank: number; id: string }) =>
  Buffer.from(`${t.rank}:${t.id}`).toString('base64url');

export function decodeCursor(cursor: string): { rank: number; id: string } {
  const raw = Buffer.from(cursor, 'base64url').toString('utf8');
  const i = raw.indexOf(':');
  const rank = Number(raw.slice(0, i));
  const id = raw.slice(i + 1);
  if (i < 0 || !Number.isFinite(rank) || !/^[0-9a-f-]{36}$/.test(id)) throw badInput('Invalid cursor');
  return { rank, id };
}

/** Rows after the cursor in (rank, id) order: rank > r OR (rank = r AND id > id). */
export function afterCursor(cursor: string | null | undefined): Prisma.TaskWhereInput {
  if (!cursor) return {};
  const c = decodeCursor(cursor);
  return { OR: [{ rank: { gt: c.rank } }, { rank: c.rank, id: { gt: c.id } }] };
}

export const pageSize = (first: number | null | undefined) => Math.min(Math.max(first ?? 50, 1), MAX_PAGE);

const KEY_RE = /^(?:[A-Za-z][A-Za-z0-9]{1,5}-)?(\d+)$/;

/** Turns the GraphQL TaskFilter into a Prisma where. `today` is in the org timezone. */
export function taskWhere(filter: TaskFilter | null | undefined, today: Date): Prisma.TaskWhereInput {
  const and: Prisma.TaskWhereInput[] = [{ deletedAt: null }];
  if (!filter) return { AND: and };
  if (filter.statusIds?.length) and.push({ statusId: { in: filter.statusIds } });
  if (filter.priorities?.length) and.push({ priority: { in: filter.priorities } });
  if (filter.assigneeIds?.length) and.push({ assignees: { some: { userId: { in: filter.assigneeIds } } } });
  if (filter.labelIds?.length) and.push({ labels: { some: { labelId: { in: filter.labelIds } } } });
  if (filter.due?.from) and.push({ dueDate: { gte: filter.due.from } });
  if (filter.due?.to) and.push({ dueDate: { lte: filter.due.to } });
  if (filter.overdue === true) and.push(overdueWhere(today));
  if (filter.overdue === false) and.push({ NOT: overdueWhere(today) });
  const search = filter.search?.trim();
  if (search) {
    const key = KEY_RE.exec(search);
    and.push({
      OR: [
        { title: { contains: search, mode: 'insensitive' } },
        ...(key ? [{ number: Number(key[1]) }] : []),
      ],
    });
  }
  return { AND: and };
}

/** Overdue = due before today (org timezone) and not in a COMPLETED/CANCELLED status. */
export function overdueWhere(today: Date): Prisma.TaskWhereInput {
  return { dueDate: { lt: today }, status: { category: { notIn: [...CLOSED_CATEGORIES] } } };
}

export const withoutStatusFilter = (f: TaskFilter | null | undefined): TaskFilter | null =>
  f ? { ...f, statusIds: null } : null;
