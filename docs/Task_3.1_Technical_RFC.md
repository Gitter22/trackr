# RFC: Task Board performance for large projects

|                        |                                                |
| ---------------------- | ---------------------------------------------- |
| **Status**             | Draft, for review                              |
| **Author**             | Aadil Shaikh                                   |
| **Reviewers**          | Board team (FE, BE), Product, Customer Success |
| **Decision needed by** | End of next sprint planning                    |

## 1. Summary

Boards with 2,000+ tasks take 6–8 s to load and stall again on every filter change and every drag. The cause is architectural: we fetch, normalize and render **every task**, and we **refetch everything** after any change. Cost grows linearly with project size, so it will keep getting worse as our largest customers grow.

**Proposal:** make the board server-driven. Each column fetches its own page (25 cards), filters and counts run on the server, drag-and-drop updates one row and patches the client cache instead of refetching, and live deltas replace polling. A prototype of the read path (Part 2) loads a **20,000-task** project in 6 small requests: 11 ms p50 per column page and 50 ms for the summary at the API.

## 2. Problem

### What users experience

- Initial load: **6–8 s** for projects with 2,000+ tasks (reported).
- Every filter change and every status update: a **full refetch and re-render**, so the board is unusable for several seconds after each interaction.
- Drag-and-drop: the card snaps back or the board freezes while the refetch completes.

### Where the time goes

Measured on our prototype schema with realistic card fields; percentages are to be confirmed in Phase 0.

| Stage            | Today: all tasks                                                                                                           | Scales with                 |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Payload          | 312 B/card → **~610 KB** at 2k, **~5.9 MB** at 20k (more if the current query also selects descriptions/comments)          | project size                |
| Server           | One large query plus per-task relation lookups (N+1 likely: 50 tasks issued 200+ queries before batching in the prototype) | project size                |
| Client normalize | Apollo writes every task, assignee and label into the cache                                                                | project size                |
| Render           | 2,000+ cards mounted at once; every refetch re-renders the board                                                           | project size                |
| Interaction      | Filter or status change → all of the above again                                                                           | project size × interactions |

**Root cause:** every stage is O(project size), and interactions repeat the whole pipeline. Tuning any single stage leaves the curve linear.

### Why it matters

- Large projects belong to our largest, highest-value organizations. The pain lands where churn costs most.
- **Data to pull in Phase 0** (not yet known): share of board loads on projects with more than 1k, 2k and 10k tasks; p75 load time per size bucket; number of affected orgs and their ARR; related support tickets.

## 3. Goals and non-goals

**Goals:** board load time independent of project size; filter changes and drags feel instant; no full refetch after any mutation; ship without disrupting current users or API consumers.

**Non-goals (this RFC):** offline mode, a full local-first sync engine (see Option C), redesigning board UX.

## 4. Options considered

### Option A: Optimize the current approach (client-side)

Keep one "fetch all" query, but trim fields, fix N+1 with DataLoader, virtualize rendering, add optimistic updates, and filter in memory.

- ✅ Smallest change. Filters become instant once the data is loaded.
- ❌ Payload, server work and cache normalization stay O(n). 20k projects are still slow to open and memory-heavy. Doesn't fix the root cause.

### Option B: Server-driven, paginated board _(recommended)_

Each column is its own keyset-paginated query. Filters and counts run on the server. Drags are single-row updates with cache patching. Live deltas over WebSocket.

- ✅ Load cost is O(columns × page size), independent of project size. Already prototyped and measured.
- ✅ Reuses our GraphQL/Postgres stack; incremental and flag-able.
- ❌ More moving parts on the client: per-column cache updates on move, and counts kept consistent across columns.
- ❌ Features that assume "all tasks are in memory" need server equivalents: select-all, browser Ctrl+F, export.

### Option C: Local-first sync engine (Linear-style)

Bootstrap the project into IndexedDB, then sync deltas. All queries run locally.

- ✅ Best possible interaction latency; enables offline use.
- ❌ A quarter-plus of platform work: sync protocol, conflict resolution, per-tenant authorization of synced data, schema migrations on clients. The initial bootstrap of a 20k project is still large.
- ❌ Doesn't help this quarter's users.

|                           | A                    | **B**          | C                        |
| ------------------------- | -------------------- | -------------- | ------------------------ |
| Load time vs project size | Linear               | **Constant**   | Constant after bootstrap |
| Filter latency            | Instant (after load) | ~100–300 ms    | Instant                  |
| Effort                    | ~2 weeks             | **~6–7 weeks** | 1–2 quarters             |
| Risk                      | Low                  | Medium         | High                     |
| Fixes root cause          | No                   | **Yes**        | Yes                      |

## 5. Recommended solution (Option B)

**API.** Most of this is already prototyped in Part 2.

- `tasks(orgId, filter: { …, statusIds: [col] }, sort: POSITION, first: 25, after)` uses the keyset index `(org_id, project_id, status_id, position)`. Measured: **0.05 ms in SQL, 11 ms p50 at the API** for a column of 3,900 tasks. Page 40 costs the same as page 1.
- `taskSummary(orgId, filter)` returns counts by status, priority and assignee plus overdue, in one snapshot with the same filter semantics as the list. Measured: **50 ms p50** at 20k tasks. If summary p95 exceeds its target at 50k+ tasks, move to a rollup table.
- `moveTask(id, statusId, afterTaskId, beforeTaskId)`: the server computes a fractional-index key between the neighbours (`fractional-indexing`). It is **one row update** with an optimistic-concurrency check and an activity-log row, and it returns the updated task. No renumbering.
- `taskChanged(projectId)` subscription (`graphql-ws`) pushes task deltas to open boards.

**Client.**

- One query per column, 25 cards, more on scroll. Rows virtualized within a column (`@tanstack/react-virtual`).
- Filters live in the URL. A filter change refetches only the visible pages (5 × 25 cards), keeping previous cards dimmed instead of blanking.
- Drag-and-drop (`@dnd-kit`):
  - An `optimisticResponse` moves the card immediately.
  - `cache.modify` removes the card from the source column's connection, inserts it into the target, and adjusts both column counts.
  - The server result reconciles. On conflict, the card returns to its server position with a toast.
  - **Zero refetches.**
- Incoming deltas patch the cache the same way, so other users' changes appear without polling.

**Product levers (for PM review).** Done and Canceled are usually the largest columns and the least looked at. Defaulting them to "last 14 days" with a "show all" link cuts load further at no engineering cost.

## 6. Performance targets

Measured with RUM (web-vitals plus custom marks) at p75 unless noted, bucketed by project size.

| Metric                                    | Today (2k tasks) | Target (2k)                          | Target (20k)       |
| ----------------------------------------- | ---------------- | ------------------------------------ | ------------------ |
| First column visible                      | 6–8 s            | **< 1.0 s**                          | < 1.2 s            |
| Board interactive (all columns + summary) | 6–8 s            | **< 1.5 s**                          | < 2.0 s            |
| Filter change → updated board             | full reload      | **< 400 ms**                         | < 500 ms           |
| Drag → card in new position               | refetch          | **< 16 ms** (optimistic, next frame) | same               |
| Move acknowledged by server, p95          | n/a              | **< 300 ms**                         | same               |
| Full refetches per interaction            | 1                | **0**                                | 0                  |
| Initial payload                           | ~610 KB+         | **< 100 KB**                         | same               |
| API column page, p95                      | n/a              | < 50 ms (prototype: 16 ms)           | same               |
| API summary, p95                          | n/a              | < 150 ms (prototype: 63 ms)          | < 250 ms or rollup |
| INP (Interaction to Next Paint)           | unknown          | < 200 ms                             | same               |
| Move error rate                           | unknown          | < 0.1 %                              | same               |

## 7. Implementation plan

Team: 2 FE, 1 BE, QA and PM part-time. About 6–7 weeks.

| Phase       | Weeks       | Scope                                                                                                                                | Exit criteria                                                    |
| ----------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| 0. Baseline | 1           | RUM marks (`board_first_column`, `board_interactive`), OpenTelemetry spans per resolver, payload histograms, `board_v2` flag per org | Dashboards show today's numbers per size bucket                  |
| 1. API      | 2–3         | Column pagination, summary, indexes (`CREATE INDEX CONCURRENTLY`), `moveTask`, `position` backfill                                   | Load test: column p95 < 50 ms at 20k; authz test matrix green    |
| 2. Client   | 3–5         | Per-column board, virtualization, URL filters, optimistic move with cache patching                                                   | Flagged internal dogfood; all targets met on staging 20k project |
| 3. Realtime | 6–7         | `taskChanged` subscription, remove remaining refetches                                                                               | Two-browser move test: < 1 s propagation                         |
| 4. Cleanup  | after 100 % | Remove v1 code path; rollups if summary is over target                                                                               | v1 traffic = 0 for 2 weeks                                       |

**Data migration.** Existing tasks need `position` keys. A batched, idempotent backfill assigns keys that preserve today's order per column (5k rows per batch). v1 ignores the new column, so the backfill is invisible until the flag is on.

## 8. Rollout strategy

1. **Dark launch.** New resolvers deploy while v1 serves traffic. Shadow-compare v2 column counts against v1 totals for flagged orgs and alert on mismatches.
2. **Internal dogfood** on our own workspace.
3. **Opt-in beta for the 10 largest orgs.** They feel the pain most, gain most, and give the best feedback. Customer Success briefs them first.
4. **Progressive rollout by project-size bucket:** 10 % → 50 % → 100 % of orgs over about 2 weeks.
5. **Guardrails that auto-halt:** board error rate > 0.5 %, move failure > 0.1 %, or p75 load regressing beyond v1 in any bucket.
6. **Rollback:** flip the flag. v1 stays deployed until 2 weeks after 100 %. Schema changes are additive only (new indexes, a new column), so rollback needs no migration.
7. **API compatibility:** the old unpaginated field stays, marked `@deprecated`, with usage tracked per client (integrations, the public API). It's removed only once usage reaches zero, with notice to API consumers.

## 9. Risks and mitigations

| Risk                                                           | Mitigation                                                                 |
| -------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Browser Ctrl+F no longer finds cards that aren't loaded        | Prominent server-side search filter (trigram index already in place)       |
| Select-all, bulk edit and export assumed everything was loaded | Server-side bulk mutations that take a filter; async export job            |
| Keyset pages skip or duplicate a card moved mid-scroll         | Delta subscription patches cache by id; dedupe by id on merge              |
| Column counts briefly disagree after concurrent edits          | Counts adjusted optimistically; summary refetched (debounced) after deltas |
| Fractional keys grow under repeated inserts at one spot        | Background rebalance when a key exceeds 50 characters                      |
| WebSocket infrastructure is new for us                         | Phase 3 is separable; Phases 1–2 deliver most of the gain without it       |

## 10. Open questions

1. **PM:** default Done/Canceled to the last 14 days? Is there a real need to scroll all 2,000 cards, or is filtering enough?
2. **PM/CS:** which customers join the beta, and what do we tell them?
3. **Eng:** do we need a rollup table for summaries now, or only past 50k tasks per project? (The prototype suggests later.)
4. **Eng:** move ordering in "All projects" views. Is position meaningful across projects, or should those views sort by priority/date only?
