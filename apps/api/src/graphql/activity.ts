import { Prisma, type ActivityType } from '../generated/tenant';

export interface ActivityEntry {
  type: ActivityType;
  field?: string;
  from?: unknown;
  to?: unknown;
}

const json = (v: unknown) => (v === undefined || v === null ? Prisma.DbNull : (v as Prisma.InputJsonValue));

/** Writes history rows inside the caller's transaction, so history can't drift from the data. */
export async function logActivity(
  tx: Prisma.TransactionClient,
  taskId: string,
  actorId: string,
  entries: ActivityEntry[],
) {
  if (!entries.length) return;
  await tx.taskActivity.createMany({
    data: entries.map((e) => ({
      taskId,
      actorId,
      type: e.type,
      field: e.field ?? null,
      fromValue: json(e.from),
      toValue: json(e.to),
    })),
  });
}

export const ref = (x: { id: string; name: string }) => ({ id: x.id, name: x.name });
export const day = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : null);
