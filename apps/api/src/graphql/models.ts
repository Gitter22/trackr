import type { Prisma, Task } from '../generated/tenant';

/** Parent object for TaskConnection: totalCount is only counted if the client asks for it. */
export interface TaskConnectionModel {
  edges: { cursor: string; node: Task }[];
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
    endCursor: string | null;
  };
  where: Prisma.TaskWhereInput;
}
