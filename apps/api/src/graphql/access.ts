import type { Project } from '../generated/tenant';
import { can, type Action, type PolicyTarget, type Resource } from '../policy/policy';
import type { GraphQLContext } from './context';
import { forbidden, notFound } from './errors';

/** Policy facts about a project for the current viewer. Owners count as members of every project. */
export async function projectTarget(ctx: GraphQLContext, project: Project): Promise<PolicyTarget> {
  const isProjectMember = ctx.user.role === 'OWNER' || (await ctx.loaders.isMember.load(project.id));
  return { isProjectMember, projectArchived: project.archivedAt !== null };
}

/**
 * Loads a project and checks `resource.action` on it. A project the viewer
 * can't see answers NOT_FOUND (don't reveal it exists); a visible project with
 * a denied action answers FORBIDDEN.
 */
export async function authorizeProject<R extends Resource>(
  ctx: GraphQLContext,
  projectId: string,
  resource: R,
  action: Action<R>,
  extra: PolicyTarget = {},
): Promise<Project> {
  const project = await ctx.loaders.projectById.load(projectId);
  if (!project) throw notFound('Project not found');
  const target = { ...(await projectTarget(ctx, project)), ...extra };
  if (!can(ctx.user, 'project', 'view', target)) throw notFound('Project not found');
  if (!can(ctx.user, resource, action, target)) throw forbidden(`Not allowed: ${String(action)} ${resource}`);
  return project;
}

export async function canViewProject(ctx: GraphQLContext, project: Project): Promise<boolean> {
  return can(ctx.user, 'project', 'view', await projectTarget(ctx, project));
}
