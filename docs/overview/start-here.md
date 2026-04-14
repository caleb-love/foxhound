# Start Here

Fast cold-start guide for working in Foxhound with low context overhead.

For the durable explanation of how the three-stage context model works, see [`harness-model.md`](harness-model.md).

## What Foxhound Is

Open-source observability platform for AI agent fleets. TypeScript/Node.js monorepo with Fastify API, BullMQ worker, Drizzle/Postgres, typed clients and SDKs. Multi-tenant and security-sensitive by default.

## Read This First, In This Order

Use the smallest retrieval that can answer the task.

**Audit scope rule:** If the task is an audit/review/stocktake, declare the audit depth before proceeding:
- **Surface-exhaustive** = broad repo coverage by subsystem/category with representative reads and targeted searches
- **File-by-file exhaustive** = every in-scope file is accounted for and individually inspected or explicitly classified

If generated/cache files dominate the tree, classify them explicitly as generated-noise instead of silently skipping them.

1. User request
2. Files directly related to the task
3. Active plan in `docs/plans/active/`
4. Latest relevant session note in `docs/sessions/`
5. Current diff and `git log --oneline -20`
6. `docs/overview/current-status.md`
7. `docs/overview/project-overview.md`
8. `docs/reference/engineering-notes.md`
9. Relevant spec in `docs/specs/`

If these conflict, prefer active plans and recent session evidence over stale summaries.

## Task Size Routing

### Tiny
Examples:
- narrow file read
- simple grep/search
- tiny doc or comment fix
- config confirmation
- very small mechanical edit

Default process:
- inline micro-plan only
- no plan file
- no skill unless there is an obvious hard trigger
- narrow verification only

### Medium
Examples:
- one subsystem change
- several related file edits
- targeted refactor
- modest test work

Default process:
- short inline plan
- create a plan file only if work spans sessions or needs durable review context
- load one or two best-fit skills if they materially help
- targeted verification

### Substantial
Examples:
- cross-package work
- auth/API/DB/billing/worker changes
- SDK or public interface changes
- migration or rollout risk
- likely multi-session work

Default process:
- evaluation first
- formal plan in `docs/plans/active/`
- load matching planning/review/security skills
- document durable decisions
- verify before claiming done

## Hard Triggers

Always load a matching skill or apply equivalent rigor for:
- auth/authz
- API endpoint changes
- DB queries or migrations
- tenant scoping
- billing, secrets, or sensitive telemetry
- SDK/public interface changes
- deployment/release
- substantial multi-step work
- final verification before claiming completion

## Core Repo Invariants

1. Every DB query must be scoped by `org_id`
2. `UPDATE` and `DELETE` statements must include tenant scope, not just record ID
3. Background jobs must carry tenant context explicitly
4. Untrusted content is rendered as plain text unless explicitly sanitized
5. JWT-only and API-key routes have different trust boundaries, do not blur them accidentally
6. Python SDK is primary in docs where ordering matters

## Multi-Tenant Query Examples

```ts
// GOOD
await db.select().from(traces).where(and(eq(traces.orgId, orgId), eq(traces.id, traceId)))

// BAD
await db.select().from(traces).where(eq(traces.id, traceId))

// GOOD
await db.update(apiKeys)
  .set({ revokedAt: new Date() })
  .where(and(eq(apiKeys.orgId, orgId), eq(apiKeys.id, keyId)))
```

## Verification Matrix

| Change type | Minimum verification |
|--------|--------|
| API route/handler | targeted tests, affected package typecheck, affected package lint, auth/tenant-scope review |
| DB schema or query | migration validation, affected tests, package typecheck, tenant-scope review |
| Worker/job logic | targeted tests, retry/error-path review, affected package typecheck |
| SDK / API client / CLI | package tests, package typecheck, example or integration-path validation |
| Docs-site | docs build |
| Root config/tooling | targeted command proving the config works, plus impacted checks if relevant |
| Refactor with no behavior change | targeted tests proving parity, affected lint/typecheck |

## Skills to Reach For

- Planning: `autoplan`, `plan-eng-review`, `plan-ceo-review`
- Security: `security-review`
- Research before building unfamiliar things: `search-first`
- Verification: `verification-loop`
- Debugging: `investigate`
- Domain work: `backend-patterns`, `api-design`, `database-migrations`, `tdd-workflow`

Do not load skills by ritual. Load them when they materially improve the odds of a correct result.

## Documentation Rules

- append to one session note per day: prefer `docs/sessions/session-YYYY-MM-DD.md`; if a handoff file variant already exists for the day, append there instead of creating a competing second daily note
- create plans only for substantial or cross-session work
- update durable docs only when truth changed
- keep `docs/overview/`, `docs/reference/`, and `docs/roadmap/` updated after milestone-level state changes
- for GTM, brand, positioning, and outreach work, prefer `docs/reference/foxhound-gtm-source-of-truth.md` over older launch/brand/website drafts when they conflict

## Useful Commands

```bash
pnpm build
pnpm test
pnpm lint
pnpm typecheck
pnpm --filter <package> <script>
git log --oneline -20
```

## Workspace Package Resolution Debugging Order

When `apps/web` or another app fails to resolve a workspace package such as `@foxhound/demo-domain` or `@foxhound/api-client`, debug in this order:

1. verify the package is actually linked in the consumer's `node_modules`
2. verify the package `exports` map points where you expect
3. if the package exports from `dist/`, build the dependency package before editing app code
4. only after 1–3 pass should you touch TS path mappings or import specifiers

For Foxhound web dev specifically, several workspace packages export compiled files from `dist/`. A missing build artifact can look like a Next module-resolution bug even when the real problem is just unbuilt local package output.

## If You Are Unsure What Is Current

Recover in this order:
1. direct task files
2. active plan
3. latest relevant session note or handoff file for the day
4. current diff / recent commits
5. `docs/overview/current-status.md` / `docs/overview/project-overview.md` / `docs/reference/engineering-notes.md`

This repo should recover context from files, not from long chat memory.
