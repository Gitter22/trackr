# Trcker: notes for coding sessions

Multi-tenant project management app. One Postgres DB per tenant, a control-plane DB, and Nginx routing by subdomain. Read README.md for setup and docs/TECHNICAL_DESIGN.md for the design.

## Commands

- Start the stack: `npm run docker:up` (full Docker), or `npm run services:up` then `npm run dev`. Both use port 5173, so run one at a time.
- Tests: `npm test`. API tests need Postgres and Redis running. They create `control_test_db` and `tenant_t_*` databases and clean them up on the next run.
- Before committing: `npm run lint && npm run typecheck && npm test`. The pre-commit hook runs lint, typecheck and schema validation, but **not tests**.
- After editing `apps/api/src/graphql/schema/*.graphql`, run `npm run codegen`. API resolver types are committed in `src/graphql/__generated__`. Web types are generated on dev, build and typecheck.
- After editing a `.prisma` file, run `npm run db:migrate:dev:control` or `npm run db:migrate:dev:tenant` to create a migration. Then `npm run db:migrate:tenants` applies it to every existing tenant DB.

## Where things live

- **Tenant request pipeline:** `apps/api/src/app.ts`. Order: proxy secret → `resolveTenant` → `rateLimit` → `attachTenantPrisma` → `requireTenantUser` → route or GraphQL.
- **Permissions:** `apps/api/src/policy/policy.ts` is the only place they're defined. Resolvers call `authorizeProject()` (`graphql/access.ts`). A project the viewer can't see answers NOT_FOUND; a visible project with a denied action answers FORBIDDEN. The web app mirrors this in `apps/web/src/apps/tenant/permissions.ts`, but only to hide buttons.
- **DataLoaders:** `graphql/loaders.ts`, created per request in `graphql/context.ts`. New list or relation fields must go through a loader. `graphql/batching.test.ts` and the board test in `task.test.ts` fail if the query count grows with the number of items.
- **Ordering:** `lib/fractional.ts` (statuses use a step of 100, task ranks a step of 1000). Task moves take an advisory lock on the column and renumber it when the gap gets too small.
- **History:** every task change writes `TaskActivity` in the same transaction (`graphql/activity.ts`). Deletes are soft deletes and record `deletedById`.
- **Overdue** is worked out, never stored: `dueDate < today in the org timezone` and the category isn't COMPLETED or CANCELLED.

## Gotchas found the hard way

- **Prettier reformats files.** Scripted search-and-replace edits on formatted files often match nothing and fail silently. Use the Edit tool, or check the change landed.
- **Never `pkill -f <pattern>`** when the pattern appears in your own command line: it kills the shell. Kill by PID.
- **Vitest resolves graphql's ESM build** while Yoga uses CJS, which gives two `GraphQLError` classes. `apps/api/vitest.config.ts` aliases graphql to CJS; keep that alias.
- **The web app uses Vitest 5** (Vite 8). The API uses Vitest 3. jest-dom matchers are registered by hand in `apps/web/src/test/setup.ts`, because jest-dom's own setup would pick up the hoisted Vitest 3.
- **graphql-request headers** can be a `Headers` object. Copy them with `new Headers(...)`, never with object spread, or `Content-Type` is lost and the API answers 415.
- **Nginx:** a `location` that sets any `proxy_set_header` drops all inherited ones. Every proxied location includes `conf.d/proxy_headers.inc`.
- **Prisma P2023** (a malformed UUID) is mapped to 400 / `BAD_USER_INPUT`. Don't let raw Prisma errors reach clients.
- **Column names are camelCase** in Postgres (no `@map`), so raw SQL needs quotes: `"statusId"`. Table names are snake_case.
- **Tenant test slugs must start with `t-`**, so global setup can clean them up.

## Conventions

- Smallest change that does the job. Reuse existing helpers: `parse()` for Zod in GraphQL, `HttpError` for REST, `useProjectMutation` and `useTaskMutations` on the web side.
- New UI pieces follow shadcn/ui. The theme tokens are in `apps/web/src/index.css`: primary `#7600FD`, text `#000000`.
- Commit messages are plain and short.
