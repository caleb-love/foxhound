# Foxhound Hardening & Refinement Plan

**Date:** 2026-04-11
**Scope:** Systematic review of Phases 0-5 — all gaps, missing implementations, and quality issues
**Status:** Reviewed by CTO, Security Lead, and Developer Advocate — feedback incorporated

---

## Executive Summary

Phases 0-5 are functionally complete but have accumulated significant technical debt, missing indexes, untested code paths, and incomplete features that were deferred during rapid implementation. This plan addresses everything found during the systematic audit before moving to Phase 6.

**Critical finding:** ~70,000 lines of database query code have zero test coverage. The cost_usd migration is missing (will cause runtime failures). Three planned span indexes were never created.

### Review Feedback (Incorporated)

**CTO:** Approved with changes — move security before features, add load testing, cut demo instance and Cloudflare to post-Phase 6. H1+H2+H5 is minimum viable hardening if timeline pressure hits.

**Security Lead:** Two Phase 6 blockers identified:
1. `traces.orgId` is nullable — potential multi-tenant data isolation failure
2. Unredacted customer traces sent to third-party LLM providers without per-org consent gate
Also: API keys need `expiresAt`, `scopes`, `lastUsedAt` columns. Audit logging must ship in H1 not H5.

**Developer Advocate:** Compress to 7-8 days. Run sprints in parallel. Demo instance should be in H4. Start Phase 6 design on day 5. Audit SDK error messages for developer experience.

---

## Audit Findings by Severity

### CRITICAL (Will cause runtime failures, data issues, or security breaches)

| # | Phase | Issue | Location |
|---|-------|-------|----------|
| C1 | 0 | `cost_usd` column exists in schema but NOT in migration — Phase 4 cost worker will crash | `schema.ts:162` vs `0006_normalize_spans.sql` |
| C2 | 0 | Missing 3 span indexes: `(org_id, kind)`, `(org_id, start_time_ms)`, `(parent_span_id)` — sequential scans at scale | `schema.ts` / migrations |
| C3 | 4 | Model pricing overrides: schema exists but NO API routes, NO worker logic, NO pricing calculations | `schema.ts:424-445` — dead schema |
| C4 | 0 | **[Security]** `traces.orgId` is nullable — traces can exist without org association, potential multi-tenant isolation bypass | `schema.ts:106` |
| C5 | 2 | **[Security]** Full unredacted customer trace payloads sent to OpenAI in LLM judge — no per-org consent gate, no field redaction, no opt-in toggle | `evaluator.ts:46-56` |

### HIGH (Significant quality/security/reliability gaps)

| # | Phase | Issue | Location |
|---|-------|-------|----------|
| H1 | All | ZERO test coverage on `packages/db` (~70K lines of query code) | `packages/db/src/queries.ts` |
| H2 | All | ZERO test coverage on `packages/cli` (3 command modules) | `packages/cli/src/commands/` |
| H3 | All | ZERO test coverage on `packages/api-client` (21K of HTTP client) | `packages/api-client/` |
| H4 | All | ZERO E2E tests (no real API endpoint testing anywhere) | — |
| H5 | 2 | LLM Judge hardcoded to OpenAI API only — evaluator `model` field exists but unused | `apps/worker/src/queues/evaluator.ts:66-132` |
| H6 | 5 | MCP server tools have minimal test coverage (1 test file for 31 tools) | `packages/mcp-server/src/` |
| H7 | 0 | No true micro-batch ingestion — `setImmediate()` deferral only, not buffer+flush | `apps/api/src/routes/traces.ts:307-311` |
| H8 | 2 | No DLQ monitoring — failed evaluator jobs disappear silently after 3 retries | `apps/worker/src/queues/evaluator.ts` |
| H9 | 1 | OTLP route input validation is manual, not Zod schema | `apps/api/src/routes/otlp.ts` |
| H10 | All | **[Security]** API keys have no `expiresAt`, `scopes`, or `lastUsedAt` — leaked keys live forever with full access | `schema.ts:72-95` |
| H11 | All | **[Security]** No audit logging for sensitive operations (key creation/revocation, billing changes, evaluator deletion) | `apps/api/` |
| H12 | All | No load testing — indexes and micro-batching have no validation under pressure | — |

### MEDIUM (Missing planned features, incomplete implementations)

| # | Phase | Issue | Location |
|---|-------|-------|----------|
| M1 | 4 | SDK `on_budget_exceeded` callback not implemented (planned in roadmap) | `packages/sdk/`, `packages/sdk-py/` |
| M2 | 3 | CLI `foxhound datasets add-traces` command not implemented | `packages/cli/src/commands/` |
| M3 | 3 | TypeScript SDK missing datasets/experiments namespace (Python has it) | `packages/sdk/src/client.ts` |
| M4 | 1 | Demo instance / sandbox org not implemented | — |
| M5 | 1 | Cloudflare integration not wired up (CDN/WAF) | — |
| M6 | 0 | Legacy `traces.spans` JSONB column still present (dual-write active) | `schema.ts:111`, `persistence.ts:18-20` |
| M7 | 4 | Multi-agent coordination has fields but no dedicated query endpoints | traces table only |
| M8 | 5 | PR comment posting in quality gate action — referenced but not fully implemented | `.github/actions/quality-gate/run.ts` |
| M9 | 2 | Annotation queue assignment is first-come-first-serve only — no role-based routing | `apps/api/src/routes/annotations.ts` |

### LOW (Polish, documentation, minor improvements)

| # | Phase | Issue | Location |
|---|-------|-------|----------|
| L1 | All | No CSRF protection (low risk — JWT-based, not cookie-based auth) | `apps/api/src/index.ts` |
| L2 | 5 | Claude Agent SDK integration has no dedicated docs page | `docs-site/docs/integrations/` |
| L3 | 2 | Evaluator concurrency/rate limits not configurable per-org | `apps/worker/src/queues/evaluator.ts` |
| L4 | 5 | MCP Registry publication still pending (manual npm login + OAuth) | `packages/mcp-server/PUBLISH.md` |
| L5 | 5 | docs.foxhound.dev DNS CNAME still pending | Domain registrar |

---

## Hardening Sprints (Revised Per Review Feedback)

### Sprint H1: Critical Fixes & Security Foundation (Days 1-2)

**Goal:** Fix runtime failures, tenant isolation, and establish audit logging from day one.

| Task | Issue | What |
|------|-------|------|
| H1.1 | C1 | Create migration `0008_add_span_cost_usd.sql` — add `cost_usd numeric(12,6)` to spans table |
| H1.2 | C2 | Create migration `0009_add_span_indexes.sql` — add 3 missing indexes: `(org_id, kind)`, `(org_id, start_time_ms)`, `(parent_span_id)` |
| H1.3 | C4 | **[BLOCKER]** Fix nullable `traces.orgId` — add `.notNull()` constraint, migration to backfill any null rows and add NOT NULL |
| H1.4 | C5 | **[BLOCKER]** Add per-org LLM evaluation consent gate — `llmEvaluationEnabled` boolean on organizations (default false). Block evaluator runs unless enabled. Add opt-in acknowledgment to evaluator creation flow |
| H1.5 | H11 | Add audit logging for sensitive operations — API key create/revoke, billing changes, evaluator create/delete, org settings changes. Structured log entries with actor, action, target, timestamp |
| H1.6 | H10 | Add `expiresAt`, `scopes`, `lastUsedAt` columns to `api_keys` table. Enforce expiry in auth middleware. Update `lastUsedAt` on each authenticated request |

**Acceptance:**
- [ ] `pnpm build` passes
- [ ] Migrations apply cleanly on fresh database
- [ ] `traces.orgId` is NOT NULL — verified in migration
- [ ] Evaluator runs reject when org has `llmEvaluationEnabled = false`
- [ ] All sensitive operations emit audit log entries
- [ ] Expired API keys are rejected at auth time

---

### Sprint H2: Test Coverage (Days 2-6, overlaps with H1)

**Goal:** Get test coverage from 60% to 90%+ package coverage. Focus on highest-risk untested code.

| Task | Issue | What |
|------|-------|------|
| H2.1 | H1 | Database integration tests for `packages/db` — test top 20 queries against real PostgreSQL (testcontainers). **Must include org_id scoping validation: every multi-tenant query tested with wrong org_id returning zero rows** |
| H2.2 | H6 | MCP server tool tests — integration tests for 10+ critical tools (search, explain_failure, score, evaluator, dataset tools) |
| H2.3 | H4 | E2E test suite — supertest hitting real API with test database. Cover: trace ingestion, scoring, evaluator run, dataset curation, experiment lifecycle |
| H2.4 | H9 | Add Zod schema for OTLP ExportTraceServiceRequest and replace manual validation |
| H2.5 | H3 | Unit tests for `packages/api-client` — HTTP methods, error handling, auth header injection |
| H2.6 | — | **[New]** Audit SDK error messages for clarity — verify every error path returns actionable messages to developers |
| H2.7 | — | **[New from H1 review]** Fix `Record<string, unknown>` type unsafety in Drizzle `.set()` calls — `updateEvaluator`, `updateEvaluatorRunStatus`, and similar functions lose column-level type safety. Replace with properly typed partial objects (e.g., `typeof evaluators.$inferInsert`) so typos in field names are compile errors, not silent no-ops |
| H2.8 | — | **[New from H1 review]** Fix `rowCount` double-cast pattern — `(result as unknown as { rowCount?: number }).rowCount !== 0` treats `undefined` as truthy. Affects `revokeApiKey`, `deleteEvaluator`, and other mutation return checks. Replace with `(result.rowCount ?? 0) > 0` or use Drizzle's `.returning()` pattern consistently |

**Acceptance:**
- [ ] `packages/db` has 30+ integration tests with org_id isolation verification
- [ ] `packages/mcp-server` has 40+ tool tests
- [ ] E2E suite covers full trace → score → evaluator → dataset flow
- [ ] `packages/api-client` has 20+ unit tests
- [ ] All tests pass in CI
- [ ] Zero `Record<string, unknown>` passed to Drizzle `.set()` — all update functions use typed partials
- [ ] Zero `as unknown as { rowCount }` casts — mutation results checked safely

**Deferred:** CLI tests (`packages/cli`) — moved to Phase 6 onboarding sprint per CTO recommendation.

---

### Sprint H3: Security Review & Worker Reliability (Days 3-6, overlaps with H2)

**Goal:** Complete security audit, harden workers, add multi-provider LLM and load testing.

| Task | Issue | What |
|------|-------|------|
| H3.1 | — | **Security review of all API routes** — verify org_id scoping has no bypass paths, check for mass assignment in PATCH endpoints, verify raw API keys never appear in logs |
| H3.2 | H5 | Implement multi-provider LLM judge — parse `evaluator.model` as `provider:model` (e.g., `openai:gpt-4o`, `anthropic:claude-sonnet-4-20250514`). Add field-level redaction option for sensitive span attributes before sending to LLM |
| H3.3 | H8 | Implement DLQ monitoring — add `evaluator-runs-dlq` queue, handler that marks runs as permanently failed, alert notification for DLQ events |
| H3.4 | H7 | Implement true micro-batch ingestion — **design spike first**: define buffer size ceiling, crash-safety strategy, backpressure behavior. Then implement buffer+flush (100ms or 50 traces) |
| H3.5 | H12 | **[New]** Add load test script (k6 or autocannon) for trace ingestion endpoint — validate indexes and micro-batching under 100+ traces/sec burst |
| H3.6 | — | Verify Stripe webhook signature validation with invalid signatures in integration test |
| H3.7 | — | **[New from H1 review]** Sanitize LLM error responses before persisting to `evaluatorRuns.error` — raw upstream error bodies (OpenAI, Anthropic) can contain account identifiers, rate-limit quotas, and internal routing info. Truncate to safe max, strip non-printable chars, log full body internally only |
| H3.8 | — | **[New from H1 review]** Move worker-only DB functions (`getEvaluatorById`, `getEvaluatorRun`) out of public `@foxhound/db` barrel export — either to a separate `@foxhound/db/internal` entrypoint or rename with `Internal` suffix. Add `no-restricted-imports` ESLint rule in `apps/api/` to prevent accidental use of unscoped queries in API routes |
| H3.9 | — | **[New from H1 review]** Replace `console.log`/`console.error` in worker with structured logger — `apps/worker/src/queues/evaluator.ts` lines 224, 229, 234 use raw console calls. Use pino or the BullMQ worker's logger context for structured, queryable production logs |
| H3.10 | — | **[New from H2 review]** Add org_id scoping to annotation queue item operations — `completeAnnotationQueueItem`, `skipAnnotationQueueItem`, and `getAnnotationQueueItem` in `packages/db/src/queries.ts` accept bare `itemId` without verifying the item belongs to the requesting org. Add org verification via JOIN to `annotationQueues` |
| H3.11 | — | **[New from H2 review]** Add orgId parameter to dataset item DB functions — `getDatasetItem(id)` and `deleteDatasetItem(id)` in `packages/db/src/queries.ts` don't scope by org. Add orgId parameter and WHERE clause, matching the pattern used by other resource types |
| H3.12 | — | **[New from H2 review]** Replace `console.error` with structured logger in `apps/api/src/routes/billing-webhook.ts` |
| H3.13 | — | **[New from H2 review]** Redact `missingTraceIds` from 207 error response in experiments route — leaks submitted trace IDs to client, should return count only |
| H3.14 | — | **[New from H2 review]** Fix `getSpanStructureForVersion` frequency math bug — when `totalTraces > limit`, frequency percentages are calculated against the sampled subset, not the total population. Either document this as "sampled frequency" or scale results |
| H3.15 | — | **[New from H2 review]** Fix 2 pre-existing ESLint errors in `packages/mcp-server/src/index.ts` — `no-inner-declarations` at line 768 and `restrict-plus-operands` at line 1421 |

**Acceptance:**
- [ ] Security reviewer agent finds zero CRITICAL issues
- [ ] Evaluator runs work with both OpenAI and Anthropic models
- [ ] Sensitive span attributes redactable before LLM submission
- [ ] Failed evaluator jobs land in DLQ with notification
- [ ] Load test passes at 100 traces/sec for 60 seconds without errors
- [ ] Stripe webhook rejects invalid signatures (tested)
- [ ] Zero raw upstream error bodies in `evaluatorRuns.error` — all sanitized
- [ ] Zero unscoped DB functions importable from `@foxhound/db` in API routes — enforced by ESLint
- [ ] Zero `console.log`/`console.error` in worker production code
- [ ] All annotation queue item operations verify org ownership
- [ ] All dataset item DB functions accept and filter by orgId
- [ ] No `console.error` in billing-webhook (structured logger used)
- [ ] Experiment 207 response returns `missingCount` not `missingTraceIds`
- [ ] `getSpanStructureForVersion` frequency math documented or fixed
- [ ] Zero ESLint errors in `mcp-server/src/index.ts`

---

### Sprint H4: SDK Parity & Missing Features (Days 5-8)

**Goal:** Complete planned features, achieve SDK parity, fill user-facing gaps.

| Task | Issue | What |
|------|-------|------|
| H4.1 | C3 | Implement model pricing override API routes: `GET/PUT/DELETE /v1/pricing-overrides` and wire worker cost calculations to check overrides before built-in pricing |
| H4.2 | M3 | Add datasets and experiments namespaces to TypeScript SDK (`fox.datasets.create/list/addItems/fromTraces`, `fox.experiments.create/list/compare`) |
| H4.3 | M1 | Implement SDK `on_budget_exceeded` callback in both TypeScript and Python SDKs |
| H4.4 | M7 | Add multi-agent coordination query endpoint: `GET /v1/traces/coordination/:correlationId`. **Prerequisite:** create migration for `traces.parent_agent_id` and `traces.correlation_id` columns + indexes (`traces_correlation_id_idx`, `traces_org_agent_start_idx`) — these exist in schema.ts but have no migration |
| H4.5 | M2 | Implement `foxhound datasets add-traces` CLI command |
| H4.6 | M8 | Complete PR comment posting in GitHub Actions quality gate |
| H4.7 | L2 | Add Claude Agent SDK integration docs page to docs-site |
| H4.8 | M6 | Evaluate JSONB backfill completeness. If complete, create migration to drop `traces.spans` JSONB column and remove dual-write code |

**Acceptance:**
- [ ] TypeScript SDK has full datasets/experiments/budgets API parity with Python
- [ ] `foxhound datasets add-traces` CLI command works
- [ ] Coordination endpoint returns multi-agent graph
- [ ] Quality gate posts/updates PR comments with idempotent markers
- [ ] Pricing override API routes work and cost worker uses them

---

## Sprint Sequencing (Revised)

```
Day:  1    2    3    4    5    6    7    8
H1:   ████████                              Critical fixes + security foundation
H2:        ████████████████████             Test coverage (starts after H1.1-H1.3)
H3:             ████████████████            Security review + worker hardening
H4:                       ████████████      SDK parity + missing features
P6:                       ~~design~~        Phase 6 design begins (parallel)
                                    ────────
                                    ~8 days
```

**Minimum viable hardening (if timeline pressure):** H1 + H2.1 + H3.1 = 4 days. Then start Phase 6.

**Phase 6 design** starts on Day 5 so implementation can begin immediately after hardening merges.

---

## Success Metrics (Post-Hardening)

| Metric | Current | Target |
|--------|---------|--------|
| Package test coverage | 60% (6/10) | 90%+ (9/10) |
| Total test count | ~403 | 650+ |
| E2E test coverage | 0 | 5+ critical flows |
| DB query tests | 0 | 30+ |
| Critical issues | 5 (C1-C5) | 0 |
| Missing migrations | 2 (cost_usd, orgId NOT NULL) | 0 |
| Missing indexes | 3 | 0 |
| LLM providers supported | 1 (OpenAI) | 2+ (OpenAI, Anthropic) |
| Security review issues | 5+ (C4, C5, H10, H11, H12) | 0 CRITICAL, 0 HIGH |
| API key security | No expiry, no scopes | Expiry + scopes + lastUsedAt |
| Tenant isolation | Nullable orgId | NOT NULL + tested |

---

## Explicitly Deferred (Post-Phase 6)

| Item | Reason |
|------|--------|
| M4 — Demo instance / sandbox | Infrastructure task, not hardening (CTO) |
| M5 — Cloudflare CDN/WAF integration | Not blocking production (CTO) |
| L1 — CSRF protection | Low risk since JWT-only auth (DevEx) |
| H2 — CLI test coverage | Defer to Phase 6 onboarding sprint (CTO) |
| L3 — Per-org evaluator concurrency limits | Nice-to-have, not a hardening item |
| M9 — Annotation queue role-based assignment | Feature request, not a gap |

---

## Phase 6 Blockers

These must be resolved before Phase 6 starts (per Security Lead):

1. **C4** — `traces.orgId` NOT NULL migration (H1.3)
2. **C5** — LLM evaluation per-org consent gate (H1.4)
3. **C1** — cost_usd migration (H1.1)

Everything else in the plan improves quality but does not block Phase 6 launch.

---

## Post-Hardening: Ready for Phase 6

After these 4 sprints (~8 days), the codebase will be:
- **Stable** — no runtime failures, proper indexes, complete migrations
- **Tested** — 650+ tests across 90% of packages, E2E coverage, org_id isolation verified
- **Reliable** — DLQ monitoring, micro-batch ingestion, multi-provider LLM, load tested
- **Complete** — all Phase 0-5 planned features implemented, SDK parity achieved
- **Secure** — tenant isolation hardened, audit logging, API key expiry/scoping, LLM consent gate, Stripe webhook verified

Then Phase 6 (Prompt Management & Growth) builds on a solid foundation.
