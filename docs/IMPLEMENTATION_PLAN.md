# Trcker — Implementation Plan

## Progress
- [x] **Phase A** — Schema design (Prisma control + tenant, GraphQL SDL, RBAC policy) — *waiting for review*
  - [x] A1 `prisma/control.prisma`
  - [x] A2 `prisma/tenant.prisma`
    - Review fix: soft deletes on Task, Label, Comment record `deletedAt` + `deletedById`; Project records `archivedById`. Deletes also go to `TaskActivity`.
  - [x] A3 GraphQL SDL in `apps/api/src/graphql/schema/`
  - [x] A4 RBAC policy `apps/api/src/policy/policy.ts` (+ tests)
- [ ] **Phase B** — Technical design doc
- [ ] **Phase C** — Critical analysis
- [ ] **Phase D** — Build (D1–D14)

## Context
`/home/aadil/Projects/trcker` is empty (no git, no code). We are building **Trcker**, a multi-tenant project management app (like Linear/Jira) from scratch. It has two main parts:
1. **Multi-tenancy.** One database per tenant, a control-plane DB, routing by subdomain through Nginx, Redis for tenant lookup and rate limits, and a cached Prisma client per tenant.
2. **Kanban built on GraphQL.** GraphQL Yoga with SDL, DataLoaders, cursor pagination ordered by `rank`, filters, a summary query and a chart.

The work runs in phases A → B → C → D. **Each phase stops for your review and approval before the next one starts.** This plan is copied to `docs/IMPLEMENTATION_PLAN.md`, and each step is checked off there as it finishes.

## Defaults I'll use (change them if you want)
- **Local domain:** `trcker.localhost`. The `*.localhost` subdomains resolve to 127.0.0.1 in Chrome without editing `/etc/hosts`. Admin lives at `admin.trcker.localhost` and a tenant at `kiksasa.trcker.localhost`. Prod would use `APP_DOMAIN=trcker.com`. All of this is set by env vars.
- **Ports:** Nginx on `:80` (with Docker). Without Docker, Vite runs on `:5173` and the API on `:4000`. In that case Vite's proxy plays Nginx's role: it reads the Host header and sets `X-Tenant-Slug` the same way.
- **Seeded super admin:** `superadmin@trackr.com` / `Test@123`, as written in the spec. Default passwords `OrgOwner@123` and `User@123` come from env.
- **Node:** Docker images use `node:24-alpine`. Your machine has Node 26. The code targets 24 (`engines`, `.nvmrc`).
- **Backend:** TypeScript compiled to CommonJS (`"module": "commonjs"`).

## Repo layout
```
package.json (npm workspaces: apps/*)   .env.example  .env.local  .gitignore  .dockerignore
docker-compose.yml   nginx/nginx.conf   CLAUDE.md   README.md
prisma/control.prisma   prisma/tenant.prisma   prisma/migrations/{control,tenant}/
docs/IMPLEMENTATION_PLAN.md  docs/TECHNICAL_DESIGN.md  docs/CRITICAL_ANALYSIS.md
apps/api/  src/{server.ts, app.ts, config/, control/, tenant/, middleware/, graphql/{schema/*.graphql, resolvers/, loaders/, context.ts}, rest/, policy/, lib/}  test/
apps/web/  src/{main.tsx, routes/, apps/{marketing,admin,tenant}/, components/ui (shadcn), hooks/, api/{rest.ts, gql.ts, generated/}, lib/}  codegen.ts
```
Root scripts: `dev`, `build`, `start`, `typecheck`, `lint`, `format`, `test`, `db:generate`, `db:migrate:control`, `db:migrate:tenants`, `validate:schemas` (`prisma validate` and `graphql-inspector validate`/`graphql-schema-linter`), `docker:up`/`docker:down`. Husky pre-commit runs lint-staged (eslint and prettier), then typecheck, then schema validation.

---

## Phase A — Schema design (stop for review)
**A1. `prisma/control.prisma`**
- `SuperAdmin(id, email unique, passwordHash, name)`
- `User(id, name, email unique, createdAt)`, the org owners
- `Organization(id, title, slug unique, dbName unique, dbUser, dbPasswordEnc, status enum[PROVISIONING, ACTIVE, INACTIVE, FAILED], ownerId → User, projectLimit, timezone, createdAt, provisionError?)`
- The per-tenant DB password is stored encrypted with AES-256-GCM, using a key from env.

**A2. `prisma/tenant.prisma`**
- `User(id, email unique, name, passwordHash, role enum[OWNER, ADMIN, MEMBER, VIEWER], isActive, createdAt)`
- `OrgSetting(key, value Json)`. This is the spec's "OrgRule" / workspace settings, e.g. timezone and project limit copied from the control plane.
- `Project(id, title, description, shortCode unique, archivedAt?, taskSeq Int, createdById)`
- `ProjectMember(projectId, userId, PK both)`
- `TaskStatus(id, projectId, name, category enum[NOT_STARTED, STARTED, COMPLETED, CANCELLED], position Float, color)`, unique on (projectId, name)
- `Task(id, projectId, number Int, key "KIK-12", title, description, priority enum, statusId, rank Float, dueDate?, completedAt?, createdById, updatedAt, deletedAt?)`
- `TaskAssignee(taskId, userId)`
- `Label(id, projectId, name, color)` and `TaskLabel(taskId, labelId)`
- `Comment(id, taskId, authorId, parentId? (one level only, checked in code), body, createdAt, editedAt?)`
- `TaskActivity(id, taskId, actorId, type enum, field?, fromValue Json?, toValue Json?, createdAt)`

**About "overdue":** it is computed as `dueDate < now(in org timezone)` and category not in {COMPLETED, CANCELLED}. It is **not** stored as a status category. This keeps status changes simple. I'll explain the choice in docs B. The API still reports it as a virtual category in the summary.

**Indexes:**
- `Task(projectId, rank, id)` for pagination
- `Task(projectId, statusId, rank, id)` for board columns
- `Task(projectId, dueDate)`
- `TaskAssignee(userId, taskId)` for "assigned to me"
- `TaskActivity(taskId, createdAt)`
- `Comment(taskId, createdAt)`
- `TaskStatus(projectId, position)`
- `ProjectMember(userId)`

**A3. GraphQL SDL** in `apps/api/src/graphql/schema/*.graphql`:
- Types: `Viewer`, `User`, `Project`, `TaskStatus`, `Task`, `Label`, `Comment` (with `replies`), `TaskActivity`
- `TaskConnection/TaskEdge/PageInfo` in Relay style. The cursor is base64 of `rank:id`.
- `TaskFilter{statusIds, assigneeIds, priorities, dueFrom, dueTo, overdue, search}`
- Queries: `viewer`, `projects`, `project(id)`, `tasks(projectId, filter, first, after)`, `task(id)`, `projectSummary(projectId){countsByStatus, countsByCategory, overdueCount, perAssignee}`, `myTasks(filter: {overdue})` (across projects)
- Mutations: project create/update/archive, add/remove member, status create/update/reorder/delete (with a move-to status), task create/update/move(`statusId`, `beforeId`/`afterId` → new rank)/delete, labels, comments create/reply/edit/delete
- `apps/api/codegen.ts` generates resolver types. The web app's codegen generates its client types.

**A4. RBAC policy:** `apps/api/src/policy/policy.ts`. It holds a single map `role → resource → action → rule`. Resources: Org, User, Project, ProjectMember, TaskStatus, Task, Comment, Label. A rule is either `true`/`false` or a predicate such as `isProjectMember` or `isCommentAuthor`. One function, `can(ctx, resource, action, target?)`, answers every check. The map follows the spec:
- **Owner** can do everything.
- **Admin** can do everything in projects they're assigned to and can manage statuses, but cannot create projects or users.
- **Member** can create and edit tasks and comments in assigned projects.
- **Viewer** can only read assigned projects.

**Phase A deliverable:** the two `.prisma` files, the `.graphql` files and `policy.ts`, all passing `prisma validate` and the GraphQL schema check. Then I stop for your review.

---

## Phase B — Technical doc (stop for review)
`docs/TECHNICAL_DESIGN.md`, 2–3 pages in plain language:
- Data model rationale and an ER diagram (mermaid)
- Query patterns, with GraphQL and SQL for "my overdue tasks across projects", a board column page, the summary, and activity
- Indexing strategy
- Multi-tenancy isolation: request flow diagram, DB per tenant, separate DB credentials per tenant, JWT scoped to the tenant
- Migration strategy: `prisma migrate` for the control plane, and a tenant migration runner that applies `migrate deploy` to every tenant DB in a loop, tracking each DB's version and handling failures one tenant at a time. Includes the expand/contract approach.

## Phase C — Critical analysis (stop for review)
`docs/CRITICAL_ANALYSIS.md` covers:
- N+1 risks per resolver field, and which DataLoader covers each
- Consistency: rank collisions and when to rebalance, concurrent moves, status delete or category change, `taskSeq` races (row lock), and counter drift if we denormalize
- 100x scale: pool connections × tenant count, LRU churn, `pg` hitting max_connections, migrating many DBs, large activity tables (partitioning or archiving), summary query cost
- Security: header spoofing (Nginx strips it), slug mismatch in the JWT, IDOR on IDs (every query is scoped by checking project membership), stale Redis cache after deactivation (delete the key on status change), rate-limit fairness, and SQL injection in `CREATE DATABASE` (slug regex plus quoted identifier)
- Missing indexes and denormalization ideas

---

## Phase D — Build (small steps; each ends with tests passing and a git commit)
After D1, I'll ask you to set the git `origin` and push after each milestone.

| Step | What | How it's checked |
|---|---|---|
| D1 | Monorepo setup: workspaces, TS configs, eslint/prettier, husky, Zod env config (`apps/api/src/config/env.ts`), `git init` | `npm run typecheck lint` |
| D2 | docker-compose with postgres:16 (volume), redis:7 (volume), api, web, and nginx with a `server_name ~^(?<sub>.+)\.${APP_DOMAIN}$` wildcard. Nginx strips the client's `X-Tenant-Slug` and sets it from the subdomain. Root domain serves marketing. | `docker compose up` gives healthy services, and curl with each Host header reaches the right place |
| D3 | Control plane: Prisma client, super admin seed on startup, `/api/admin/auth/login` (JWT `aud=admin`, httpOnly cookie), and admin CRUD routes for users and orgs | Vitest + supertest against a test DB |
| D4 | Provisioning service. Validate the slug, create the Org as PROVISIONING, `CREATE ROLE` and `CREATE DATABASE` (owned by the role), run `prisma migrate deploy` with the tenant schema against the new URL, seed the owner (bcrypt of the default password), then set ACTIVE. On failure, set FAILED and save the error. Activate/deactivate deletes the Redis key. | Integration test checks that the DB exists, the tables exist and the owner can log in. Also a DB query test. |
| D5 | Tenant pipeline middlewares, in order: `tenantResolver` (header → Redis with 60s TTL → control DB, 404 JSON if unknown or inactive), `rateLimiter` (Redis token bucket in a Lua script, keyed by slug, env-configurable), `tenantPrisma` (lru-cache whose `dispose` calls `$disconnect`, URL includes `connection_limit=N`), `auth` (JWT `aud=tenant:<slug>` must match the request slug) | Unit tests for each middleware: cache hit and miss, bucket refill, eviction disconnects, slug mismatch returns 401 |
| D6 | Public endpoint `GET /api/tenant/status` for the frontend's 404 check. Tenant REST auth: login and me. Users module (owner/admin: create, change role, activate/deactivate). | supertest |
| D7 | GraphQL Yoga mounted at `/graphql`. Context factory builds `{prisma, user, slug, loaders: createLoaders(prisma)}` on each request. Loaders: userById, statusById, statusesByProject, labelsByTask, assigneesByTask, commentCountByTask, repliesByComment, projectById, membership. Resolvers for projects, members and statuses (with position midpoint math and rebalancing). | Resolver unit tests, plus a test that counts Prisma queries to show batching (no N+1) |
| D8 | Tasks: create (`taskSeq` incremented in a transaction for keys like "KIK-12"), update, move (rank = midpoint of neighbours, rebalance when the gap < ε), filters, cursor pagination on `(rank, id)`, activity written in the same transaction as each change, comments and one-level replies, summary and `myTasks` queries (overdue uses the org timezone) | Tests for pagination correctness across pages and ties, rank math, policy matrix tests, and EXPLAIN tests confirming the indexes are used |
| D9 | Web foundations: Tailwind theme (primary `#7600FD`, text `#000000`), shadcn/ui, router that picks the marketing, admin or tenant app from `location.host`, axios + graphql-request clients, react-query, codegen, and tenant-prefixed localStorage keys (`trcker:<slug>:...`) | Vitest + Testing Library for host parsing and storage keys |
| D10 | Marketing page, admin panel (login, sidebar, Users and Organizations with create, activate/deactivate and status badges), and the tenant 404 page | Component tests |
| D11 | Tenant app: login, sidebar, Users page, Projects list/create/archive, project members, status settings (drag to reorder) | Component and hook tests |
| D12 | Kanban board with **@dnd-kit**: one infinite-scroll column per status (cursor pages), optimistic moves, a filter bar (status, assignee, priority, due range), a summary panel and a **Recharts** chart (tasks by status and per assignee), and a task detail drawer (edit fields, labels, assignees, comments with replies, activity timeline) | Component tests for the board reducer and filters |
| D13 | End-to-end check in the browser (the built-in browser; chrome-devtools-mcp if you have it set up). Run the full journey: super admin logs in → creates owner and org → `kiksasa.trcker.localhost` → owner logs in → creates user, project, statuses, tasks → drag across columns → filter → comment and reply → activity shows up → deactivate org → tenant 404. Then an unknown slug gives 404. Fix whatever breaks. | Browser run, with screenshots |
| D14 | README (setup with and without Docker), CLAUDE.md, final check of `.env.example` | Fresh `docker compose up` from a clean volume |

## Key libraries
express, graphql-yoga, graphql, @graphql-tools/load-files, dataloader, @prisma/client (two generated clients with separate `output` paths), ioredis, lru-cache, jsonwebtoken, bcryptjs, zod, cookie-parser, pino, vitest, supertest. Web: react, vite, @tanstack/react-query, graphql-request, axios, @graphql-codegen/cli (client preset), react-router, tailwindcss, shadcn/ui, @dnd-kit/core + sortable, recharts, react-hook-form + zod.

## Verification overall
- `npm run typecheck && npm run lint && npm test` pass at every step, and the husky hook enforces them.
- Integration tests run against Postgres and Redis from docker compose.
- The D13 browser journey runs both through Nginx (Docker) and through the Vite proxy (no Docker).
