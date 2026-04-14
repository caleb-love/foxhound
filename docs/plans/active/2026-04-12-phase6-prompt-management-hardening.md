# Phase 6 Prompt Management — Hardening & Follow-ups

**Date:** 2026-04-12
**Status:** Deferred items from 4-agent review (security, TypeScript, Python, architecture)
**Phase 6 core implementation:** Complete (schema, queries, routes, tests, SDKs, MCP tools, API client)

---

## Completed in Review Pass

- [x] TOCTOU race on version auto-increment → wrapped in `db.transaction()`
- [x] `setPromptLabel` non-atomic → wrapped in `db.transaction()`
- [x] Version queries missing `orgId` scope → all join through `prompts` table now
- [x] `updatedAt` UPDATE missing org scope → scoped inside transaction
- [x] N+1 query on version listing → batch `getLabelsForVersions`
- [x] Python SDK cache not thread-safe → `threading.Lock` added
- [x] `ResolvedPrompt` not exported from Python `__init__.py` → added
- [x] Python `import time` deferred unnecessarily → moved to top-level
- [x] Python `float()` on budget headers unguarded → try/except added
- [x] Python `invalidate(label=...)` silently clears all → raises `ValueError`

---

## HIGH Priority — Reconciled Status

### 1. Rate limiting on prompt endpoints

**Status:** ✅ implemented

Implemented in `apps/api/src/routes/prompts.ts`:
- `GET /v1/prompts/resolve` → `max: 600, timeWindow: '1 minute'`
- `POST /v1/prompts` → `max: 30, timeWindow: '1 minute'`
- `POST /v1/prompts/:id/versions` → `max: 30, timeWindow: '1 minute'`
- `POST /v1/prompts/:id/labels` → `max: 60, timeWindow: '1 minute'`
- `DELETE /v1/prompts/:id/labels/:label` → `max: 60, timeWindow: '1 minute'`
- `GET /v1/prompts/:id/versions` → `max: 600, timeWindow: '1 minute'`

### 2. API key scope enforcement

**Status:** ✅ completed for the first major non-JWT backend hardening wave

Implemented in `apps/api/src/plugins/auth.ts`:
- `prompts:read`
- `prompts:write`
- `traces:read` / `traces:write`
- `scores:read` / `scores:write`
- `datasets:read` / `datasets:write`
- `experiments:read` / `experiments:write`
- `evaluators:read` / `evaluators:write`
- `annotations:read` / `annotations:write`
- `regressions:read` / `regressions:write`
- `budgets:read` / `budgets:write`
- `slas:read` / `slas:write`
- `notifications:read` / `notifications:write`

Targeted denial-path tests were added for these route families in:
- `apps/api/src/routes/traces.test.ts`
- `apps/api/src/routes/scores.test.ts`
- `apps/api/src/routes/datasets.test.ts`
- `apps/api/src/routes/experiments.test.ts`
- `apps/api/src/routes/evaluators.test.ts`
- `apps/api/src/routes/annotations.test.ts`
- `apps/api/src/routes/regressions.test.ts`
- `apps/api/src/routes/budgets.test.ts`
- `apps/api/src/routes/slas.test.ts`
- `apps/api/src/routes/notifications.test.ts`

### 3. Catch unique-constraint violation on prompt creation

**Status:** ✅ implemented

`POST /v1/prompts` now catches PostgreSQL `23505` unique violations and returns `409 Conflict` instead of a 500.

### 4. Add missing test coverage

**Status:** ✅ implemented

Present in `apps/api/src/routes/prompts.test.ts`:
- `GET /v1/prompts/:id`
- `GET /v1/prompts/:id/versions`
- 401 without auth header
- 403 scope-denial cases for prompt read/write

---

## FRONTEND HARDENING FOLLOW-UP — Completed in This Session

### Dashboard wireframe hardening

**Status:** ✅ implemented

Frontend hardening completed in `apps/web/` with a wireframe-first, future-restyle-friendly approach:
- consistent unauthenticated redirects on dashboard trace surfaces
- safe user-facing fallback copy for trace and diff fetch failures
- resilient login flow (`try/catch/finally`, no stuck loading state)
- reusable page-state shells extracted to `apps/web/components/ui/page-state.tsx`
- shared UI-state rendering applied to trace list/detail/diff pages

### Frontend tests added

**Status:** ✅ implemented

Behavior-focused tests now cover the most bug-prone wireframe flows:
- `apps/web/app/(auth)/login/page.test.tsx`
- `apps/web/components/ui/page-state.test.tsx`
- `apps/web/components/traces/trace-table.test.tsx`
- `apps/web/components/traces/trace-timeline.test.tsx`
- `apps/web/components/diff/run-diff-view.test.tsx`
- `apps/web/components/diff/timeline-diff.test.tsx`

Covered behaviors include:
- login success/failure/throw/loading states
- shared page-state rendering
- trace table empty/filter/compare flow
- compare selection rollover behavior
- timeline click-to-open detail behavior
- diff insight rendering
- timeline diff empty-state and change-marker rendering

## MEDIUM Priority — Queue for Iteration

### 5. Audit logging for read operations

**Source:** Security review #8

Read operations (especially `GET /v1/prompts/resolve`) produce no audit entries. For compliance-grade forensics, resolve calls should log the requesting org, IP, prompt name, label, and version returned.

### 6. Pagination on `listPrompts`

**Status:** ✅ implemented

Implemented end-to-end:
- DB query now accepts `page` and `limit`
- API route validates and returns pagination metadata
- API client accepts optional pagination params
- prompt route tests cover pagination passthrough

### 7. Server-side caching for resolve endpoint

**Status:** ✅ implemented (v1 in-memory cache)

Implemented in `apps/api/src/routes/prompts.ts`:
- 30-second in-memory cache for `GET /v1/prompts/resolve`
- cache key: org + prompt name + label
- route tests cover repeated resolve success for the same key

Future upgrade path if needed:
- Redis or distributed cache for cross-instance consistency
- explicit cache invalidation on prompt writes

### 8. Prompt content sanitization documentation

**Status:** ✅ documented

Untrusted content rendering guidance is now documented in:
- `SECURITY.md`
- `docs/reference/engineering-notes.md`

Rule: prompt content and other user-controlled text must be treated as untrusted and rendered as plain text unless explicitly sanitized.

### 9. Python SDK metadata key convention

**Source:** Python review

`set_prompt()` uses `snake_case` metadata keys (`prompt_name`, `prompt_version`, `prompt_label`). Verify whether the API server and dashboard expect `camelCase` (`promptName`, etc.) and align.

### 10. `DELETE /v1/prompts/:id/labels/:label` endpoint

**Status:** ✅ implemented in API

Route exists in `apps/api/src/routes/prompts.ts` and is covered in `apps/api/src/routes/prompts.test.ts`.

---

## LOW Priority — Backlog

- `model` field has no allowlist validation (informational only for v1)
- Audit log writes are fire-and-forget with no retry (codebase-wide pattern)
- `_PromptCacheEntry` TypedDict missing docstring for `expires_at` semantics
- No prompt version diff/comparison endpoint
- No `description` field on prompts table (consider for dashboard UX)
- No cross-instance cache invalidation mechanism (5min TTL is the contract)
- Prompt cache TTL not configurable via `FoxhoundClient` constructor in either SDK
- `concurrent.futures` unused import in Python `tracer.py:156`

---

## Files Modified in Phase 6

```
packages/db/src/schema.ts          — prompts, promptVersions, promptLabels tables
packages/db/src/queries.ts         — 15 query functions (transactional version create + label set)
packages/billing/src/entitlements.ts — canManagePrompts entitlement
packages/billing/src/entitlements.test.ts — entitlement assertions
packages/billing/src/metering.test.ts — canManagePrompts in mock
apps/api/src/routes/prompts.ts     — Full route file (CRUD, versions, labels, resolve)
apps/api/src/routes/prompts.test.ts — 14 test cases
apps/api/src/index.ts              — Route registration
apps/api/src/middleware/entitlements.test.ts — canManagePrompts in mock
packages/sdk/src/client.ts         — PromptsNamespace with cache
packages/sdk/src/tracer.ts         — setPrompt() method
packages/sdk/src/index.ts          — ResolvedPrompt export
packages/sdk-py/foxhound/client.py — PromptsNamespace with thread-safe cache
packages/sdk-py/foxhound/tracer.py — set_prompt() method
packages/sdk-py/foxhound/__init__.py — ResolvedPrompt export
packages/api-client/src/index.ts   — 8 prompt methods
packages/api-client/src/types.ts   — Prompt response types
packages/mcp-server/src/index.ts   — 6 MCP prompt tools
```
