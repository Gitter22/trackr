import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { graphql } from '@/api/generated';
import type { CreateTaskInput, MoveTaskInput, TaskFilter, UpdateTaskInput } from '@/api/generated/graphql';
import { projectKeys } from '../projects/queries';
import { useTenantSession } from '../session';

export const PAGE_SIZE = 25;

graphql(`
  fragment BoardCard on Task {
    id
    key
    title
    priority
    dueDate
    isOverdue
    rank
    commentCount
    status {
      id
    }
    assignees {
      id
      name
    }
    labels {
      id
      name
      color
    }
  }
`);

export const ColumnQuery = graphql(`
  query BoardColumn($projectId: ID!, $filter: TaskFilter, $first: Int, $after: String) {
    tasks(projectId: $projectId, filter: $filter, first: $first, after: $after) {
      edges {
        cursor
        node {
          ...BoardCard
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  }
`);

export const SummaryQuery = graphql(`
  query ProjectSummary($projectId: ID!, $filter: TaskFilter) {
    projectSummary(projectId: $projectId, filter: $filter) {
      total
      overdueCount
      byStatus {
        status {
          id
          name
          category
          color
        }
        count
      }
      byCategory {
        category
        count
      }
      byAssignee {
        user {
          id
          name
        }
        count
        overdue
      }
    }
  }
`);

export const TaskQuery = graphql(`
  query TaskDetail($id: ID!) {
    task(id: $id) {
      id
      key
      title
      description
      priority
      dueDate
      isOverdue
      completedAt
      createdAt
      updatedAt
      createdBy {
        id
        name
      }
      status {
        id
        name
        category
      }
      assignees {
        id
        name
      }
      labels {
        id
        name
        color
      }
      comments {
        id
        body
        isDeleted
        createdAt
        editedAt
        author {
          id
          name
        }
        replies {
          id
          body
          isDeleted
          createdAt
          editedAt
          author {
            id
            name
          }
        }
      }
      activity {
        id
        type
        field
        fromValue
        toValue
        createdAt
        actor {
          id
          name
        }
      }
    }
  }
`);

const CreateTask = graphql(`
  mutation CreateTask($input: CreateTaskInput!) {
    createTask(input: $input) {
      id
      key
    }
  }
`);
const UpdateTask = graphql(`
  mutation UpdateTask($id: ID!, $input: UpdateTaskInput!) {
    updateTask(id: $id, input: $input) {
      id
    }
  }
`);
const MoveTask = graphql(`
  mutation MoveTask($input: MoveTaskInput!) {
    moveTask(input: $input) {
      id
      rank
      status {
        id
      }
    }
  }
`);
const DeleteTask = graphql(`
  mutation DeleteTask($id: ID!) {
    deleteTask(id: $id)
  }
`);
const AddComment = graphql(`
  mutation AddComment($input: AddCommentInput!) {
    addComment(input: $input) {
      id
    }
  }
`);
const EditComment = graphql(`
  mutation EditComment($id: ID!, $body: String!) {
    editComment(id: $id, body: $body) {
      id
    }
  }
`);
const DeleteComment = graphql(`
  mutation DeleteComment($id: ID!) {
    deleteComment(id: $id)
  }
`);
const CreateLabel = graphql(`
  mutation CreateLabel($input: LabelInput!) {
    createLabel(input: $input) {
      id
      name
      color
    }
  }
`);

export const boardKeys = {
  all: (projectId: string) => ['board', projectId] as const,
  /** Prefix keys for invalidation: every column, one column (all filters), every summary. */
  columns: (projectId: string) => ['board', projectId, 'column'] as const,
  columnAll: (projectId: string, statusId: string) => ['board', projectId, 'column', statusId] as const,
  summaryAll: (projectId: string) => ['board', projectId, 'summary'] as const,
  column: (projectId: string, statusId: string, filter: TaskFilter) =>
    ['board', projectId, 'column', statusId, filter] as const,
  summary: (projectId: string, filter: TaskFilter) => ['board', projectId, 'summary', filter] as const,
  task: (id: string) => ['task', id] as const,
};

/** One board column, loaded page by page (cursor pagination). */
export function useColumn(projectId: string, statusId: string, filter: TaskFilter) {
  const { gql } = useTenantSession();
  return useInfiniteQuery({
    queryKey: boardKeys.column(projectId, statusId, filter),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) =>
      (
        await gql(ColumnQuery, {
          projectId,
          filter: { ...filter, statusIds: [statusId] },
          first: PAGE_SIZE,
          after: pageParam,
        })
      ).tasks,
    getNextPageParam: (last) => (last.pageInfo.hasNextPage ? last.pageInfo.endCursor : null),
  });
}

export function useSummary(projectId: string, filter: TaskFilter) {
  const { gql } = useTenantSession();
  return useQuery({
    queryKey: boardKeys.summary(projectId, filter),
    queryFn: async () => (await gql(SummaryQuery, { projectId, filter })).projectSummary,
  });
}

export function useTask(id: string | null) {
  const { gql } = useTenantSession();
  return useQuery({
    queryKey: boardKeys.task(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => (await gql(TaskQuery, { id: id! })).task,
  });
}

/**
 * Task mutations. Each one refreshes only what it can change:
 * - the column(s) the task was in or moved to (every filter variant of them),
 * - the summary (only refetches if the Insights tab is open; otherwise just marked stale),
 * - the open task, if any,
 * - project task counts only when a task is created or deleted.
 * Every mutation's variables say which column(s) it touched (statusId / fromStatusId).
 */
export function useTaskMutations(projectId: string) {
  const { gql } = useTenantSession();
  const qc = useQueryClient();
  const refresh = ({
    statusIds,
    taskId,
    counts,
  }: {
    statusIds: (string | null | undefined)[];
    taskId?: string;
    counts?: boolean;
  }) => {
    const columns = [...new Set(statusIds.filter(Boolean))] as string[];
    // Unknown column (e.g. create without a statusId): refresh them all.
    if (columns.length === 0) void qc.invalidateQueries({ queryKey: boardKeys.columns(projectId) });
    for (const statusId of columns)
      void qc.invalidateQueries({ queryKey: boardKeys.columnAll(projectId, statusId) });
    void qc.invalidateQueries({ queryKey: boardKeys.summaryAll(projectId) });
    if (taskId) void qc.invalidateQueries({ queryKey: boardKeys.task(taskId) });
    if (counts) void qc.invalidateQueries({ queryKey: projectKeys.lists });
  };
  return {
    create: useMutation({
      mutationFn: (input: CreateTaskInput) => gql(CreateTask, { input }),
      onSettled: (_d, _e, v) => refresh({ statusIds: [v.statusId as string | undefined], counts: true }),
    }),
    update: useMutation({
      mutationFn: (v: { id: string; statusId: string; input: UpdateTaskInput }) =>
        gql(UpdateTask, { id: v.id, input: v.input }),
      onSettled: (_d, _e, v) => refresh({ statusIds: [v.statusId], taskId: v.id }),
    }),
    move: useMutation({
      mutationFn: ({ fromStatusId: _from, ...input }: MoveTaskInput & { fromStatusId: string }) =>
        gql(MoveTask, { input }),
      onSettled: (_d, _e, v) =>
        refresh({ statusIds: [v.fromStatusId, String(v.statusId)], taskId: String(v.id) }),
    }),
    remove: useMutation({
      mutationFn: (v: { id: string; statusId: string }) => gql(DeleteTask, { id: v.id }),
      onSettled: (_d, _e, v) => refresh({ statusIds: [v.statusId], counts: true }),
    }),
    addComment: useMutation({
      mutationFn: (v: { taskId: string; statusId: string; body: string; parentId?: string }) =>
        gql(AddComment, { input: { taskId: v.taskId, body: v.body, parentId: v.parentId } }),
      onSettled: (_d, _e, v) => refresh({ statusIds: [v.statusId], taskId: v.taskId }),
    }),
    editComment: useMutation({
      mutationFn: (v: { taskId: string; statusId: string; id: string; body: string }) =>
        gql(EditComment, { id: v.id, body: v.body }),
      onSettled: (_d, _e, v) => refresh({ statusIds: [v.statusId], taskId: v.taskId }),
    }),
    deleteComment: useMutation({
      mutationFn: (v: { taskId: string; statusId: string; id: string }) => gql(DeleteComment, { id: v.id }),
      onSettled: (_d, _e, v) => refresh({ statusIds: [v.statusId], taskId: v.taskId }),
    }),
    createLabel: useMutation({
      mutationFn: (v: { name: string; color?: string }) => gql(CreateLabel, { input: { projectId, ...v } }),
      onSettled: () => void qc.invalidateQueries({ queryKey: projectKeys.all }),
    }),
  };
}
