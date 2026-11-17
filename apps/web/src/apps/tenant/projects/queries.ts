import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { graphql } from '@/api/generated';
import type { CreateProjectInput, StatusCategory } from '@/api/generated/graphql';
import { useTenantSession } from '../session';

export const ProjectsQuery = graphql(`
  query Projects($includeArchived: Boolean) {
    projects(includeArchived: $includeArchived) {
      id
      title
      description
      shortCode
      archivedAt
      archivedBy {
        id
        name
      }
      taskCount
      members {
        id
        name
      }
    }
  }
`);

export const ProjectQuery = graphql(`
  query Project($id: ID!) {
    project(id: $id) {
      id
      title
      description
      shortCode
      archivedAt
      createdAt
      createdBy {
        id
        name
      }
      members {
        id
        name
        email
        role
        isActive
      }
      statuses {
        id
        name
        category
        position
        color
      }
      labels {
        id
        name
        color
      }
    }
  }
`);

const CreateProject = graphql(`
  mutation CreateProject($input: CreateProjectInput!) {
    createProject(input: $input) {
      id
      shortCode
    }
  }
`);
const UpdateProject = graphql(`
  mutation UpdateProject($id: ID!, $input: UpdateProjectInput!) {
    updateProject(id: $id, input: $input) {
      id
      title
      description
    }
  }
`);
const ArchiveProject = graphql(`
  mutation ArchiveProject($id: ID!) {
    archiveProject(id: $id) {
      id
      archivedAt
    }
  }
`);
const UnarchiveProject = graphql(`
  mutation UnarchiveProject($id: ID!) {
    unarchiveProject(id: $id) {
      id
      archivedAt
    }
  }
`);
const AddMember = graphql(`
  mutation AddProjectMember($projectId: ID!, $userId: ID!) {
    addProjectMember(projectId: $projectId, userId: $userId) {
      id
    }
  }
`);
const RemoveMember = graphql(`
  mutation RemoveProjectMember($projectId: ID!, $userId: ID!) {
    removeProjectMember(projectId: $projectId, userId: $userId) {
      id
    }
  }
`);
const CreateStatus = graphql(`
  mutation CreateStatus($input: CreateStatusInput!) {
    createStatus(input: $input) {
      id
    }
  }
`);
const UpdateStatus = graphql(`
  mutation UpdateStatus($id: ID!, $input: UpdateStatusInput!) {
    updateStatus(id: $id, input: $input) {
      id
    }
  }
`);
const MoveStatus = graphql(`
  mutation MoveStatus($input: MoveStatusInput!) {
    moveStatus(input: $input) {
      id
      position
    }
  }
`);
const DeleteStatus = graphql(`
  mutation DeleteStatus($id: ID!, $moveTasksToStatusId: ID!) {
    deleteStatus(id: $id, moveTasksToStatusId: $moveTasksToStatusId)
  }
`);

export const projectKeys = {
  all: ['projects'] as const,
  /** Prefix for both project lists (with and without archived). */
  lists: ['projects', 'list'] as const,
  list: (includeArchived: boolean) => ['projects', 'list', includeArchived] as const,
  detail: (id: string) => ['projects', 'detail', id] as const,
};

export function useProjects(includeArchived = false) {
  const { gql } = useTenantSession();
  return useQuery({
    queryKey: projectKeys.list(includeArchived),
    queryFn: async () => (await gql(ProjectsQuery, { includeArchived })).projects,
  });
}

export function useProject(id: string) {
  const { gql } = useTenantSession();
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: async () => (await gql(ProjectQuery, { id })).project,
  });
}

/** Mutation that refreshes every project query afterwards. */
function useProjectMutation<V, R>(fn: (vars: V) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: () => qc.invalidateQueries({ queryKey: projectKeys.all }),
  });
}

export function useProjectMutations() {
  const { gql } = useTenantSession();
  return {
    create: useProjectMutation((input: CreateProjectInput) => gql(CreateProject, { input })),
    update: useProjectMutation((v: { id: string; title?: string; description?: string | null }) =>
      gql(UpdateProject, { id: v.id, input: { title: v.title, description: v.description } }),
    ),
    archive: useProjectMutation((id: string) => gql(ArchiveProject, { id })),
    unarchive: useProjectMutation((id: string) => gql(UnarchiveProject, { id })),
    addMember: useProjectMutation((v: { projectId: string; userId: string }) => gql(AddMember, v)),
    removeMember: useProjectMutation((v: { projectId: string; userId: string }) => gql(RemoveMember, v)),
    createStatus: useProjectMutation(
      (v: { projectId: string; name: string; category: StatusCategory; color?: string }) =>
        gql(CreateStatus, { input: v }),
    ),
    updateStatus: useProjectMutation(
      (v: { id: string; name?: string; category?: StatusCategory; color?: string }) =>
        gql(UpdateStatus, { id: v.id, input: { name: v.name, category: v.category, color: v.color } }),
    ),
    moveStatus: useProjectMutation(
      (v: { id: string; afterStatusId?: string | null; beforeStatusId?: string | null }) =>
        gql(MoveStatus, { input: v }),
    ),
    deleteStatus: useProjectMutation((v: { id: string; moveTasksToStatusId: string }) =>
      gql(DeleteStatus, v),
    ),
  };
}
