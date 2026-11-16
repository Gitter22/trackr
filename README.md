# Trcker

A multi-tenant project management app (in the spirit of Linear or Jira).

Each organization gets:

- its own address, `<slug>.<domain>`
- its own Postgres database, with its own database login
- projects, a Kanban board, comments and a full history of who changed what

A control panel at `admin.<domain>` creates and manages the organizations.

**Stack**

- **Frontend:** React 19, Vite, TypeScript, Tailwind, shadcn/ui, react-query, graphql-request, axios, dnd-kit, Recharts.
- **Backend:** Node 24, Express (CommonJS), GraphQL Yoga, Prisma 6, PostgreSQL 16, Redis 7.
- **Entry point:** Nginx in Docker.

## Run it with Docker

You need Docker and Node 24 or newer. Node is only used to install and run the tooling.

```bash
cp .env.example .env.local
```

```bash
npm install
```

```bash
npm run docker:up
```

Open these in Chrome or Firefox. `*.localhost` works without editing `/etc/hosts`.

| URL                                 | What                                                                                                      |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------- |
| http://localhost:5173               | Marketing page                                                                                            |
| http://admin.localhost:5173         | Control panel. Sign in as `superadmin@trackr.com` / `Test@123`                                            |
| http://`<slug>`.localhost:5173      | An organization. The owner signs in with `OrgOwner@123`, and users the owner adds sign in with `User@123` |
| http://anything-else.localhost:5173 | 404 page                                                                                                  |

**First steps:**

1. In the control panel, go to **Users → New user** and create an owner.
2. Go to **Organizations → New organization** and pick that owner. The database is created and set up in about 2 seconds.
3. Open the org's link and sign in as the owner.

Credentials, default passwords, the domain, rate limits and pool sizes all come from `.env.local` (see `.env.example`). Change the secrets before deploying anywhere.

Data is kept in the Docker volumes `trcker_pgdata` and `trcker_redisdata`. `npm run docker:down` keeps them; `docker compose down -v` deletes them.

## Run it without Docker (dev mode)

Postgres and Redis still run in Docker. The API and the web app run on your machine with hot reload.

```bash
npm run services:up
```

```bash
npm run dev
```

- `npm run dev` applies control-plane migrations first. It then starts the API on `:4000` and Vite on `:5173`.
- Vite's proxy plays Nginx's role: it sets `X-Tenant-Slug` from the Host and adds the proxy secret.
- The URLs are the same as above.
- Docker mode and dev mode both use port 5173, so run one at a time. `npm run docker:down` stops the Docker app containers, and `services:up` keeps the databases.

## How a request finds its tenant

```
browser ─► Nginx / Vite proxy ─► Express API
            │                    ├─ proxy secret check (blocks direct calls)
            │                    ├─ tenant lookup: X-Tenant-Slug → Redis (60s) → control DB → 404 if unknown/inactive
            │                    ├─ rate limit: Redis token bucket per tenant
            │                    ├─ tenant DB client: LRU cache of PrismaClient per tenant (connection_limit=5)
            │                    ├─ auth: JWT audience must be tenant:<slug>
            │                    └─ REST routes or GraphQL (/graphql) with per-request DataLoaders
            └─ strips the client's X-Tenant-Slug and sets it from the subdomain
```

The databases:

- `control_panel_db` holds the super admin, org owners and organizations.
- Each organization has its own `tenant_<slug>_db`, owned by its own `tenant_<slug>_user` role, which can only open that database.

More detail is in [docs/TECHNICAL_DESIGN.md](docs/TECHNICAL_DESIGN.md).

## Roles

| Role   | Can do                                                                                           |
| ------ | ------------------------------------------------------------------------------------------------ |
| Owner  | Everything: users, projects, archive, all project work                                           |
| Admin  | In projects they belong to: edit the project, members, statuses, labels, tasks, and delete tasks |
| Member | In projects they belong to: create, edit and move tasks, assign, comment                         |
| Viewer | Read-only in projects they belong to                                                             |

All of these rules live in one file: [apps/api/src/policy/policy.ts](apps/api/src/policy/policy.ts). The UI hides buttons to match, and the API enforces the rules.

## Scripts (run from the repo root)

| Script                                                     | What it does                                                                                          |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `npm run docker:up` / `docker:down` / `docker:logs`        | Full stack in Docker (builds the images)                                                              |
| `npm run services:up` / `services:down`                    | Only Postgres and Redis                                                                               |
| `npm run dev`                                              | Migrate the control DB, then API and web with hot reload                                              |
| `npm test`                                                 | API tests (Vitest, real Postgres and Redis, so run `services:up` first) and web tests (Vitest, jsdom) |
| `npm run typecheck` / `lint` / `format`                    | TypeScript, ESLint, Prettier                                                                          |
| `npm run validate:schemas`                                 | `prisma validate` for both schemas, plus a GraphQL SDL check                                          |
| `npm run codegen`                                          | GraphQL types for the API resolvers and the web documents                                             |
| `npm run db:generate`                                      | Prisma clients (also runs after `npm install`)                                                        |
| `npm run db:migrate:control`                               | Apply control-plane migrations                                                                        |
| `npm run db:migrate:tenants`                               | Apply tenant migrations to every tenant DB, 4 at a time. Failures are reported per tenant             |
| `npm run db:migrate:dev:control` / `db:migrate:dev:tenant` | Create a new migration after editing a `.prisma` file                                                 |

The pre-commit hook (Husky) runs lint-staged (ESLint and Prettier), then typecheck, then schema validation.

To run tenant migrations inside Docker:

```bash
docker compose --env-file .env.local exec api node apps/api/dist/scripts/migrate-tenants.js
```

## Project layout

```
apps/api/        Express + GraphQL Yoga API
  src/app.ts             routes and the tenant pipeline
  src/middleware/        proxy secret, tenant resolver, rate limit, tenant Prisma, auth
  src/control/           provisioning, tenant URLs, Redis tenant cache
  src/graphql/           SDL (schema/*.graphql), resolvers, DataLoaders, context, Yoga setup
  src/rest/              admin and tenant REST routes
  src/policy/policy.ts   who can do what
apps/web/        React app (one bundle; the hostname picks marketing / admin / tenant)
  src/apps/admin/        control panel
  src/apps/tenant/       tenant app: users, projects, board, insights, task drawer
  src/components/ui/     shadcn/ui components (theme in src/index.css)
prisma/          control.prisma, tenant.prisma, migrations/{control,tenant}, config files
nginx/           gateway config (template)
docker/          Dockerfiles
docs/            design, analysis, plan, end-to-end report
```

## Docs

- [Implementation plan and progress](docs/IMPLEMENTATION_PLAN.md)
- [Technical design](docs/TECHNICAL_DESIGN.md): data model, query patterns, indexes, isolation, migrations
- [Critical analysis](docs/CRITICAL_ANALYSIS.md): N+1 risks, consistency, scale, security
- [End-to-end report](docs/E2E_REPORT.md): browser run, bugs found, screenshots
