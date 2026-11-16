import { GraphQLResolveInfo, GraphQLScalarType, GraphQLScalarTypeConfig } from 'graphql';
import { User as UserModel, Project as ProjectModel, TaskStatus as TaskStatusModel, Label as LabelModel, Task as TaskModel, Comment as CommentModel, TaskActivity as TaskActivityModel } from '../../generated/tenant';
import { TaskConnectionModel } from '../models';
import { GraphQLContext } from '../context';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
export type RequireFields<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  /** Calendar date, YYYY-MM-DD. */
  Date: { input: Date; output: Date; }
  /** ISO-8601 date-time string. */
  DateTime: { input: Date; output: Date; }
  /** Arbitrary JSON value (activity from/to values). */
  JSON: { input: unknown; output: unknown; }
};

export type ActivityType =
  | 'ASSIGNEE_ADDED'
  | 'ASSIGNEE_REMOVED'
  | 'COMMENTED'
  | 'COMMENT_DELETED'
  | 'CREATED'
  | 'DELETED'
  | 'LABEL_ADDED'
  | 'LABEL_REMOVED'
  | 'RESTORED'
  | 'STATUS_CHANGED'
  | 'UPDATED';

export type AddCommentInput = {
  body: Scalars['String']['input'];
  /** Set to reply; must be a top-level comment. */
  parentId?: InputMaybe<Scalars['ID']['input']>;
  taskId: Scalars['ID']['input'];
};

export type AssigneeCount = {
  __typename?: 'AssigneeCount';
  count: Scalars['Int']['output'];
  overdue: Scalars['Int']['output'];
  /** Null bucket = unassigned. */
  user?: Maybe<User>;
};

export type CategoryCount = {
  __typename?: 'CategoryCount';
  category: StatusCategory;
  count: Scalars['Int']['output'];
};

export type Comment = {
  __typename?: 'Comment';
  author: User;
  /** Empty string when deleted. */
  body: Scalars['String']['output'];
  createdAt: Scalars['DateTime']['output'];
  deletedAt?: Maybe<Scalars['DateTime']['output']>;
  deletedBy?: Maybe<User>;
  editedAt?: Maybe<Scalars['DateTime']['output']>;
  id: Scalars['ID']['output'];
  /** Deleted comments still appear if they have replies, shown as deleted. */
  isDeleted: Scalars['Boolean']['output'];
  /** Null for top-level comments. */
  parentId?: Maybe<Scalars['ID']['output']>;
  /** Always empty on replies (one level only). */
  replies: Array<Comment>;
};

export type CreateProjectInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  memberIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  shortCode: Scalars['String']['input'];
  title: Scalars['String']['input'];
};

export type CreateStatusInput = {
  /** Place after this status; omit to append at the end. */
  afterStatusId?: InputMaybe<Scalars['ID']['input']>;
  category: StatusCategory;
  color?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  projectId: Scalars['ID']['input'];
};

export type CreateTaskInput = {
  assigneeIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  description?: InputMaybe<Scalars['String']['input']>;
  dueDate?: InputMaybe<Scalars['Date']['input']>;
  labelIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  priority?: InputMaybe<Priority>;
  projectId: Scalars['ID']['input'];
  /** Defaults to the first status (lowest position). */
  statusId?: InputMaybe<Scalars['ID']['input']>;
  title: Scalars['String']['input'];
};

export type DateRange = {
  from?: InputMaybe<Scalars['Date']['input']>;
  to?: InputMaybe<Scalars['Date']['input']>;
};

export type Label = {
  __typename?: 'Label';
  color: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
};

export type LabelInput = {
  color?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  projectId: Scalars['ID']['input'];
};

export type MoveStatusInput = {
  afterStatusId?: InputMaybe<Scalars['ID']['input']>;
  /** Neighbours after the move; null means start/end of the list. */
  beforeStatusId?: InputMaybe<Scalars['ID']['input']>;
  id: Scalars['ID']['input'];
};

/** Drag and drop: new column and the neighbours the task lands between. */
export type MoveTaskInput = {
  /** Task directly above after the drop (null = top of column). */
  afterTaskId?: InputMaybe<Scalars['ID']['input']>;
  /** Task directly below after the drop (null = bottom of column). */
  beforeTaskId?: InputMaybe<Scalars['ID']['input']>;
  id: Scalars['ID']['input'];
  statusId: Scalars['ID']['input'];
};

export type Mutation = {
  __typename?: 'Mutation';
  _noop?: Maybe<Scalars['Boolean']['output']>;
  addComment: Comment;
  addProjectMember: Project;
  archiveProject: Project;
  createLabel: Label;
  createProject: Project;
  createStatus: TaskStatus;
  createTask: Task;
  deleteComment: Scalars['Boolean']['output'];
  deleteLabel: Scalars['Boolean']['output'];
  /** Tasks in the deleted status move to moveTasksToStatusId. */
  deleteStatus: Scalars['Boolean']['output'];
  deleteTask: Scalars['Boolean']['output'];
  editComment: Comment;
  moveStatus: TaskStatus;
  moveTask: Task;
  removeProjectMember: Project;
  unarchiveProject: Project;
  updateProject: Project;
  updateStatus: TaskStatus;
  updateTask: Task;
};


export type MutationAddCommentArgs = {
  input: AddCommentInput;
};


export type MutationAddProjectMemberArgs = {
  projectId: Scalars['ID']['input'];
  userId: Scalars['ID']['input'];
};


export type MutationArchiveProjectArgs = {
  id: Scalars['ID']['input'];
};


export type MutationCreateLabelArgs = {
  input: LabelInput;
};


export type MutationCreateProjectArgs = {
  input: CreateProjectInput;
};


export type MutationCreateStatusArgs = {
  input: CreateStatusInput;
};


export type MutationCreateTaskArgs = {
  input: CreateTaskInput;
};


export type MutationDeleteCommentArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteLabelArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteStatusArgs = {
  id: Scalars['ID']['input'];
  moveTasksToStatusId: Scalars['ID']['input'];
};


export type MutationDeleteTaskArgs = {
  id: Scalars['ID']['input'];
};


export type MutationEditCommentArgs = {
  body: Scalars['String']['input'];
  id: Scalars['ID']['input'];
};


export type MutationMoveStatusArgs = {
  input: MoveStatusInput;
};


export type MutationMoveTaskArgs = {
  input: MoveTaskInput;
};


export type MutationRemoveProjectMemberArgs = {
  projectId: Scalars['ID']['input'];
  userId: Scalars['ID']['input'];
};


export type MutationUnarchiveProjectArgs = {
  id: Scalars['ID']['input'];
};


export type MutationUpdateProjectArgs = {
  id: Scalars['ID']['input'];
  input: UpdateProjectInput;
};


export type MutationUpdateStatusArgs = {
  id: Scalars['ID']['input'];
  input: UpdateStatusInput;
};


export type MutationUpdateTaskArgs = {
  id: Scalars['ID']['input'];
  input: UpdateTaskInput;
};

/** Relay page info. Cursors are opaque (base64 of "rank:id"). */
export type PageInfo = {
  __typename?: 'PageInfo';
  endCursor?: Maybe<Scalars['String']['output']>;
  hasNextPage: Scalars['Boolean']['output'];
  hasPreviousPage: Scalars['Boolean']['output'];
  startCursor?: Maybe<Scalars['String']['output']>;
};

export type Priority =
  | 'HIGH'
  | 'LOW'
  | 'MEDIUM';

export type Project = {
  __typename?: 'Project';
  archivedAt?: Maybe<Scalars['DateTime']['output']>;
  /** Who archived it; null when active. */
  archivedBy?: Maybe<User>;
  createdAt: Scalars['DateTime']['output'];
  createdBy: User;
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  labels: Array<Label>;
  members: Array<User>;
  shortCode: Scalars['String']['output'];
  /** Ordered by position. */
  statuses: Array<TaskStatus>;
  /** Total live (non-deleted) tasks. */
  taskCount: Scalars['Int']['output'];
  title: Scalars['String']['output'];
};

export type ProjectSummary = {
  __typename?: 'ProjectSummary';
  byAssignee: Array<AssigneeCount>;
  byCategory: Array<CategoryCount>;
  byStatus: Array<StatusCount>;
  overdueCount: Scalars['Int']['output'];
  total: Scalars['Int']['output'];
};

export type Query = {
  __typename?: 'Query';
  /** Tasks assigned to the viewer across every project they can see. */
  myTasks: TaskConnection;
  project?: Maybe<Project>;
  /** Counts honour the same filter as the board (minus statusIds). */
  projectSummary: ProjectSummary;
  /** Owner sees all; others see only projects they are members of. */
  projects: Array<Project>;
  task?: Maybe<Task>;
  /** Relay pagination ordered by (rank, id). Use filter.statusIds=[x] to page one board column. */
  tasks: TaskConnection;
  viewer: Viewer;
};


export type QueryMyTasksArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<TaskFilter>;
  first?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryProjectArgs = {
  id: Scalars['ID']['input'];
};


export type QueryProjectSummaryArgs = {
  filter?: InputMaybe<TaskFilter>;
  projectId: Scalars['ID']['input'];
};


export type QueryProjectsArgs = {
  includeArchived?: InputMaybe<Scalars['Boolean']['input']>;
};


export type QueryTaskArgs = {
  id: Scalars['ID']['input'];
};


export type QueryTasksArgs = {
  after?: InputMaybe<Scalars['String']['input']>;
  filter?: InputMaybe<TaskFilter>;
  first?: InputMaybe<Scalars['Int']['input']>;
  projectId: Scalars['ID']['input'];
};

export type Role =
  | 'ADMIN'
  | 'MEMBER'
  | 'OWNER'
  | 'VIEWER';

export type StatusCategory =
  | 'CANCELLED'
  | 'COMPLETED'
  | 'NOT_STARTED'
  | 'STARTED';

export type StatusCount = {
  __typename?: 'StatusCount';
  count: Scalars['Int']['output'];
  status: TaskStatus;
};

export type Task = {
  __typename?: 'Task';
  /** Newest first. */
  activity: Array<TaskActivity>;
  assignees: Array<User>;
  commentCount: Scalars['Int']['output'];
  /** Top-level comments, oldest first; each carries its replies. */
  comments: Array<Comment>;
  completedAt?: Maybe<Scalars['DateTime']['output']>;
  createdAt: Scalars['DateTime']['output'];
  createdBy: User;
  description?: Maybe<Scalars['String']['output']>;
  dueDate?: Maybe<Scalars['Date']['output']>;
  id: Scalars['ID']['output'];
  /** Derived: dueDate before today (org timezone) and status not COMPLETED/CANCELLED. */
  isOverdue: Scalars['Boolean']['output'];
  /** e.g. KIK-12 */
  key: Scalars['String']['output'];
  labels: Array<Label>;
  number: Scalars['Int']['output'];
  priority: Priority;
  project: Project;
  rank: Scalars['Float']['output'];
  status: TaskStatus;
  title: Scalars['String']['output'];
  updatedAt: Scalars['DateTime']['output'];
};

export type TaskActivity = {
  __typename?: 'TaskActivity';
  actor: User;
  createdAt: Scalars['DateTime']['output'];
  field?: Maybe<Scalars['String']['output']>;
  fromValue?: Maybe<Scalars['JSON']['output']>;
  id: Scalars['ID']['output'];
  toValue?: Maybe<Scalars['JSON']['output']>;
  type: ActivityType;
};

export type TaskConnection = {
  __typename?: 'TaskConnection';
  edges: Array<TaskEdge>;
  pageInfo: PageInfo;
  /** Total matching the filter (not just this page). */
  totalCount: Scalars['Int']['output'];
};

export type TaskEdge = {
  __typename?: 'TaskEdge';
  cursor: Scalars['String']['output'];
  node: Task;
};

export type TaskFilter = {
  assigneeIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  due?: InputMaybe<DateRange>;
  labelIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  overdue?: InputMaybe<Scalars['Boolean']['input']>;
  priorities?: InputMaybe<Array<Priority>>;
  /** Matches title or key. */
  search?: InputMaybe<Scalars['String']['input']>;
  statusIds?: InputMaybe<Array<Scalars['ID']['input']>>;
};

export type TaskStatus = {
  __typename?: 'TaskStatus';
  category: StatusCategory;
  color: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  position: Scalars['Float']['output'];
};

export type UpdateProjectInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateStatusInput = {
  category?: InputMaybe<StatusCategory>;
  color?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateTaskInput = {
  assigneeIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  description?: InputMaybe<Scalars['String']['input']>;
  dueDate?: InputMaybe<Scalars['Date']['input']>;
  labelIds?: InputMaybe<Array<Scalars['ID']['input']>>;
  priority?: InputMaybe<Priority>;
  title?: InputMaybe<Scalars['String']['input']>;
};

export type User = {
  __typename?: 'User';
  email: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  isActive: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  role: Role;
};

/** The signed-in user plus what the UI needs to show or hide. */
export type Viewer = {
  __typename?: 'Viewer';
  orgSlug: Scalars['String']['output'];
  timezone: Scalars['String']['output'];
  user: User;
};



export type ResolverTypeWrapper<T> = Promise<T> | T;


export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<TResult, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> = ResolverFn<TResult, TParent, TContext, TArgs> | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<TResult, TKey extends string, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>> = (obj: T, context: TContext, info: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<TResult = Record<PropertyKey, never>, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;





/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = {
  ActivityType: ActivityType;
  AddCommentInput: AddCommentInput;
  AssigneeCount: ResolverTypeWrapper<Omit<AssigneeCount, 'user'> & { user?: Maybe<ResolversTypes['User']> }>;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
  CategoryCount: ResolverTypeWrapper<CategoryCount>;
  Comment: ResolverTypeWrapper<CommentModel>;
  CreateProjectInput: CreateProjectInput;
  CreateStatusInput: CreateStatusInput;
  CreateTaskInput: CreateTaskInput;
  Date: ResolverTypeWrapper<Scalars['Date']['output']>;
  DateRange: DateRange;
  DateTime: ResolverTypeWrapper<Scalars['DateTime']['output']>;
  Float: ResolverTypeWrapper<Scalars['Float']['output']>;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  JSON: ResolverTypeWrapper<Scalars['JSON']['output']>;
  Label: ResolverTypeWrapper<LabelModel>;
  LabelInput: LabelInput;
  MoveStatusInput: MoveStatusInput;
  MoveTaskInput: MoveTaskInput;
  Mutation: ResolverTypeWrapper<Record<PropertyKey, never>>;
  PageInfo: ResolverTypeWrapper<PageInfo>;
  Priority: Priority;
  Project: ResolverTypeWrapper<ProjectModel>;
  ProjectSummary: ResolverTypeWrapper<Omit<ProjectSummary, 'byAssignee' | 'byStatus'> & { byAssignee: Array<ResolversTypes['AssigneeCount']>, byStatus: Array<ResolversTypes['StatusCount']> }>;
  Query: ResolverTypeWrapper<Record<PropertyKey, never>>;
  Role: Role;
  StatusCategory: StatusCategory;
  StatusCount: ResolverTypeWrapper<Omit<StatusCount, 'status'> & { status: ResolversTypes['TaskStatus'] }>;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  Task: ResolverTypeWrapper<TaskModel>;
  TaskActivity: ResolverTypeWrapper<TaskActivityModel>;
  TaskConnection: ResolverTypeWrapper<TaskConnectionModel>;
  TaskEdge: ResolverTypeWrapper<Omit<TaskEdge, 'node'> & { node: ResolversTypes['Task'] }>;
  TaskFilter: TaskFilter;
  TaskStatus: ResolverTypeWrapper<TaskStatusModel>;
  UpdateProjectInput: UpdateProjectInput;
  UpdateStatusInput: UpdateStatusInput;
  UpdateTaskInput: UpdateTaskInput;
  User: ResolverTypeWrapper<UserModel>;
  Viewer: ResolverTypeWrapper<Omit<Viewer, 'user'> & { user: ResolversTypes['User'] }>;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  AddCommentInput: AddCommentInput;
  AssigneeCount: Omit<AssigneeCount, 'user'> & { user?: Maybe<ResolversParentTypes['User']> };
  Boolean: Scalars['Boolean']['output'];
  CategoryCount: CategoryCount;
  Comment: CommentModel;
  CreateProjectInput: CreateProjectInput;
  CreateStatusInput: CreateStatusInput;
  CreateTaskInput: CreateTaskInput;
  Date: Scalars['Date']['output'];
  DateRange: DateRange;
  DateTime: Scalars['DateTime']['output'];
  Float: Scalars['Float']['output'];
  ID: Scalars['ID']['output'];
  Int: Scalars['Int']['output'];
  JSON: Scalars['JSON']['output'];
  Label: LabelModel;
  LabelInput: LabelInput;
  MoveStatusInput: MoveStatusInput;
  MoveTaskInput: MoveTaskInput;
  Mutation: Record<PropertyKey, never>;
  PageInfo: PageInfo;
  Project: ProjectModel;
  ProjectSummary: Omit<ProjectSummary, 'byAssignee' | 'byStatus'> & { byAssignee: Array<ResolversParentTypes['AssigneeCount']>, byStatus: Array<ResolversParentTypes['StatusCount']> };
  Query: Record<PropertyKey, never>;
  StatusCount: Omit<StatusCount, 'status'> & { status: ResolversParentTypes['TaskStatus'] };
  String: Scalars['String']['output'];
  Task: TaskModel;
  TaskActivity: TaskActivityModel;
  TaskConnection: TaskConnectionModel;
  TaskEdge: Omit<TaskEdge, 'node'> & { node: ResolversParentTypes['Task'] };
  TaskFilter: TaskFilter;
  TaskStatus: TaskStatusModel;
  UpdateProjectInput: UpdateProjectInput;
  UpdateStatusInput: UpdateStatusInput;
  UpdateTaskInput: UpdateTaskInput;
  User: UserModel;
  Viewer: Omit<Viewer, 'user'> & { user: ResolversParentTypes['User'] };
};

export type AssigneeCountResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['AssigneeCount'] = ResolversParentTypes['AssigneeCount']> = {
  count?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  overdue?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  user?: Resolver<Maybe<ResolversTypes['User']>, ParentType, ContextType>;
};

export type CategoryCountResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['CategoryCount'] = ResolversParentTypes['CategoryCount']> = {
  category?: Resolver<ResolversTypes['StatusCategory'], ParentType, ContextType>;
  count?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type CommentResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Comment'] = ResolversParentTypes['Comment']> = {
  author?: Resolver<ResolversTypes['User'], ParentType, ContextType>;
  body?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  deletedAt?: Resolver<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  deletedBy?: Resolver<Maybe<ResolversTypes['User']>, ParentType, ContextType>;
  editedAt?: Resolver<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  isDeleted?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  parentId?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  replies?: Resolver<Array<ResolversTypes['Comment']>, ParentType, ContextType>;
};

export interface DateScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['Date'], any> {
  name: 'Date';
}

export interface DateTimeScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['DateTime'], any> {
  name: 'DateTime';
}

export interface JsonScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['JSON'], any> {
  name: 'JSON';
}

export type LabelResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Label'] = ResolversParentTypes['Label']> = {
  color?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type MutationResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = {
  _noop?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  addComment?: Resolver<ResolversTypes['Comment'], ParentType, ContextType, RequireFields<MutationAddCommentArgs, 'input'>>;
  addProjectMember?: Resolver<ResolversTypes['Project'], ParentType, ContextType, RequireFields<MutationAddProjectMemberArgs, 'projectId' | 'userId'>>;
  archiveProject?: Resolver<ResolversTypes['Project'], ParentType, ContextType, RequireFields<MutationArchiveProjectArgs, 'id'>>;
  createLabel?: Resolver<ResolversTypes['Label'], ParentType, ContextType, RequireFields<MutationCreateLabelArgs, 'input'>>;
  createProject?: Resolver<ResolversTypes['Project'], ParentType, ContextType, RequireFields<MutationCreateProjectArgs, 'input'>>;
  createStatus?: Resolver<ResolversTypes['TaskStatus'], ParentType, ContextType, RequireFields<MutationCreateStatusArgs, 'input'>>;
  createTask?: Resolver<ResolversTypes['Task'], ParentType, ContextType, RequireFields<MutationCreateTaskArgs, 'input'>>;
  deleteComment?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationDeleteCommentArgs, 'id'>>;
  deleteLabel?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationDeleteLabelArgs, 'id'>>;
  deleteStatus?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationDeleteStatusArgs, 'id' | 'moveTasksToStatusId'>>;
  deleteTask?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType, RequireFields<MutationDeleteTaskArgs, 'id'>>;
  editComment?: Resolver<ResolversTypes['Comment'], ParentType, ContextType, RequireFields<MutationEditCommentArgs, 'body' | 'id'>>;
  moveStatus?: Resolver<ResolversTypes['TaskStatus'], ParentType, ContextType, RequireFields<MutationMoveStatusArgs, 'input'>>;
  moveTask?: Resolver<ResolversTypes['Task'], ParentType, ContextType, RequireFields<MutationMoveTaskArgs, 'input'>>;
  removeProjectMember?: Resolver<ResolversTypes['Project'], ParentType, ContextType, RequireFields<MutationRemoveProjectMemberArgs, 'projectId' | 'userId'>>;
  unarchiveProject?: Resolver<ResolversTypes['Project'], ParentType, ContextType, RequireFields<MutationUnarchiveProjectArgs, 'id'>>;
  updateProject?: Resolver<ResolversTypes['Project'], ParentType, ContextType, RequireFields<MutationUpdateProjectArgs, 'id' | 'input'>>;
  updateStatus?: Resolver<ResolversTypes['TaskStatus'], ParentType, ContextType, RequireFields<MutationUpdateStatusArgs, 'id' | 'input'>>;
  updateTask?: Resolver<ResolversTypes['Task'], ParentType, ContextType, RequireFields<MutationUpdateTaskArgs, 'id' | 'input'>>;
};

export type PageInfoResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['PageInfo'] = ResolversParentTypes['PageInfo']> = {
  endCursor?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  hasNextPage?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  hasPreviousPage?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  startCursor?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
};

export type ProjectResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Project'] = ResolversParentTypes['Project']> = {
  archivedAt?: Resolver<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  archivedBy?: Resolver<Maybe<ResolversTypes['User']>, ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  createdBy?: Resolver<ResolversTypes['User'], ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  labels?: Resolver<Array<ResolversTypes['Label']>, ParentType, ContextType>;
  members?: Resolver<Array<ResolversTypes['User']>, ParentType, ContextType>;
  shortCode?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  statuses?: Resolver<Array<ResolversTypes['TaskStatus']>, ParentType, ContextType>;
  taskCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  title?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type ProjectSummaryResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['ProjectSummary'] = ResolversParentTypes['ProjectSummary']> = {
  byAssignee?: Resolver<Array<ResolversTypes['AssigneeCount']>, ParentType, ContextType>;
  byCategory?: Resolver<Array<ResolversTypes['CategoryCount']>, ParentType, ContextType>;
  byStatus?: Resolver<Array<ResolversTypes['StatusCount']>, ParentType, ContextType>;
  overdueCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  total?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type QueryResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = {
  myTasks?: Resolver<ResolversTypes['TaskConnection'], ParentType, ContextType, RequireFields<QueryMyTasksArgs, 'first'>>;
  project?: Resolver<Maybe<ResolversTypes['Project']>, ParentType, ContextType, RequireFields<QueryProjectArgs, 'id'>>;
  projectSummary?: Resolver<ResolversTypes['ProjectSummary'], ParentType, ContextType, RequireFields<QueryProjectSummaryArgs, 'projectId'>>;
  projects?: Resolver<Array<ResolversTypes['Project']>, ParentType, ContextType, RequireFields<QueryProjectsArgs, 'includeArchived'>>;
  task?: Resolver<Maybe<ResolversTypes['Task']>, ParentType, ContextType, RequireFields<QueryTaskArgs, 'id'>>;
  tasks?: Resolver<ResolversTypes['TaskConnection'], ParentType, ContextType, RequireFields<QueryTasksArgs, 'first' | 'projectId'>>;
  viewer?: Resolver<ResolversTypes['Viewer'], ParentType, ContextType>;
};

export type StatusCountResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['StatusCount'] = ResolversParentTypes['StatusCount']> = {
  count?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  status?: Resolver<ResolversTypes['TaskStatus'], ParentType, ContextType>;
};

export type TaskResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Task'] = ResolversParentTypes['Task']> = {
  activity?: Resolver<Array<ResolversTypes['TaskActivity']>, ParentType, ContextType>;
  assignees?: Resolver<Array<ResolversTypes['User']>, ParentType, ContextType>;
  commentCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  comments?: Resolver<Array<ResolversTypes['Comment']>, ParentType, ContextType>;
  completedAt?: Resolver<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  createdBy?: Resolver<ResolversTypes['User'], ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  dueDate?: Resolver<Maybe<ResolversTypes['Date']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  isOverdue?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  key?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  labels?: Resolver<Array<ResolversTypes['Label']>, ParentType, ContextType>;
  number?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  priority?: Resolver<ResolversTypes['Priority'], ParentType, ContextType>;
  project?: Resolver<ResolversTypes['Project'], ParentType, ContextType>;
  rank?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  status?: Resolver<ResolversTypes['TaskStatus'], ParentType, ContextType>;
  title?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
};

export type TaskActivityResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['TaskActivity'] = ResolversParentTypes['TaskActivity']> = {
  actor?: Resolver<ResolversTypes['User'], ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  field?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  fromValue?: Resolver<Maybe<ResolversTypes['JSON']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  toValue?: Resolver<Maybe<ResolversTypes['JSON']>, ParentType, ContextType>;
  type?: Resolver<ResolversTypes['ActivityType'], ParentType, ContextType>;
};

export type TaskConnectionResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['TaskConnection'] = ResolversParentTypes['TaskConnection']> = {
  edges?: Resolver<Array<ResolversTypes['TaskEdge']>, ParentType, ContextType>;
  pageInfo?: Resolver<ResolversTypes['PageInfo'], ParentType, ContextType>;
  totalCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
};

export type TaskEdgeResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['TaskEdge'] = ResolversParentTypes['TaskEdge']> = {
  cursor?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  node?: Resolver<ResolversTypes['Task'], ParentType, ContextType>;
};

export type TaskStatusResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['TaskStatus'] = ResolversParentTypes['TaskStatus']> = {
  category?: Resolver<ResolversTypes['StatusCategory'], ParentType, ContextType>;
  color?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  position?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
};

export type UserResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['User'] = ResolversParentTypes['User']> = {
  email?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  isActive?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  role?: Resolver<ResolversTypes['Role'], ParentType, ContextType>;
};

export type ViewerResolvers<ContextType = GraphQLContext, ParentType extends ResolversParentTypes['Viewer'] = ResolversParentTypes['Viewer']> = {
  orgSlug?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  timezone?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  user?: Resolver<ResolversTypes['User'], ParentType, ContextType>;
};

export type Resolvers<ContextType = GraphQLContext> = {
  AssigneeCount?: AssigneeCountResolvers<ContextType>;
  CategoryCount?: CategoryCountResolvers<ContextType>;
  Comment?: CommentResolvers<ContextType>;
  Date?: GraphQLScalarType;
  DateTime?: GraphQLScalarType;
  JSON?: GraphQLScalarType;
  Label?: LabelResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  PageInfo?: PageInfoResolvers<ContextType>;
  Project?: ProjectResolvers<ContextType>;
  ProjectSummary?: ProjectSummaryResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  StatusCount?: StatusCountResolvers<ContextType>;
  Task?: TaskResolvers<ContextType>;
  TaskActivity?: TaskActivityResolvers<ContextType>;
  TaskConnection?: TaskConnectionResolvers<ContextType>;
  TaskEdge?: TaskEdgeResolvers<ContextType>;
  TaskStatus?: TaskStatusResolvers<ContextType>;
  User?: UserResolvers<ContextType>;
  Viewer?: ViewerResolvers<ContextType>;
};

