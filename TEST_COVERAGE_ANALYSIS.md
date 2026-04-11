# Test Coverage Analysis

## Overview

Foxhound has **27 test files** covering a codebase of ~83 non-test source files. While several
critical paths (API routes, SDK tracers, billing) have solid test coverage, there are significant
gaps in the worker layer, database package, API client, CLI, and several API routes. This document
identifies the most impactful areas for improvement, prioritized by risk and business criticality.

---

## Current Coverage Summary

| Area | Source Files | Test Files | Coverage |
|------|-------------|------------|----------|
| API Routes | 17 | 13 | ~76% |
| API Middleware/Plugins | 3 | 1 | ~33% |
| API Lib/Jobs | 5 | 0 | 0% |
| Worker Queues | 8 | 0 | **0%** |
| packages/sdk (TS) | 4 | 4 | 100% |
| packages/sdk-py | 8 | 7 | ~88% |
| packages/billing | 2 | 2 | 100% |
| packages/notifications | 3 | 1 | ~33% |
| packages/db | 4 | 0 | **0%** |
| packages/types | 1 | 0 | **0%** |
| packages/api-client | 2 | 0 | **0%** |
| packages/cli | 9 | 0 | **0%** |
| packages/mcp-server | 1 | 1 | 100% |

---

## Priority 1 - Critical Gaps

### 1. Worker Queue Processors (apps/worker) - 0% coverage, ~1,150 lines

The entire `apps/worker/` package has **zero tests and no test runner configured**. This is the
highest-risk gap because these workers handle background jobs that directly affect billing,
compliance, and alerting.

**Files needing tests:**

| File | Lines | Complexity | Risk |
|------|-------|------------|------|
| `queues/evaluator.ts` | 229 | High | LLM integration, template rendering, score creation |
| `queues/experiment.ts` | 274 | High | Batch LLM execution, cost calculation, auto-scoring |
| `queues/sla-check.ts` | 172 | High | Percentile math, SLA breach detection, Redis aggregation |
| `queues/regression-detector.ts` | 166 | High | Structural drift algorithm, baseline comparison |
| `queues/cost-monitor.ts` | 122 | Medium | Budget threshold logic, alert dispatch |
| `queues/cost-reconciler.ts` | 41 | Low | Cost aggregation per period |
| `queues/sla-scheduler.ts` | 49 | Low | Idempotent job scheduling |
| `index.ts` | 97 | Low | Redis URL parsing, worker startup |

**Recommended tests:**
- Unit tests for pure algorithmic functions: `renderTemplate()`, `extractTraceContext()`,
  `detectStructuralDrift()`, percentile calculations, budget threshold logic
- Integration tests for job processors with mocked DB/Redis/LLM dependencies
- Error-path tests: LLM API failures, malformed responses, database errors, Redis timeouts

### 2. Database Package (packages/db) - 0% coverage, ~2,700 lines

The `packages/db` package contains the entire data access layer with **zero tests**. Two areas
are particularly critical:

**a) Cryptographic functions in queries.ts (~50 lines, CRITICAL):**
- `hashPassword()` - Scrypt-based password hashing with random salt
- `verifyPassword()` - Timing-safe password comparison
- `generateApiKey()` - Random key generation with SHA-256
- `hashApiKey()` - SHA-256 hashing

These are security-critical and highly testable as pure functions. A bug here could lead to
authentication bypass or credential exposure.

**b) Budget period utilities in queries.ts (~40 lines, CRITICAL):**
- `getBudgetPeriodKey()` - Generates period keys (daily/weekly/monthly) from timestamps
- `parsePeriodStart()` - Parses period keys back to timestamps

These use complex date math including ISO 8601 week numbering. They must produce deterministic,
matching results between the API and workers. Edge cases around year boundaries and week 1/52
transitions are easy to get wrong.

**Recommended tests:**
- Unit tests for all crypto functions (hash/verify round-trips, determinism, format validation)
- Property-based tests for `getBudgetPeriodKey()`/`parsePeriodStart()` round-trip consistency
- Edge case tests: year boundaries, leap years, week 1/53 in ISO 8601

### 3. Untested API Routes (apps/api) - 5 routes with 0% coverage

Five route files have no tests:

| Route File | Endpoints | Complexity | Why It Matters |
|------------|-----------|------------|----------------|
| `routes/scores.ts` | 4 endpoints | Medium | Evaluation scoring, org-scoped data |
| `routes/evaluators.ts` | 6 endpoints | High | LLM evaluator management, job queueing |
| `routes/annotations.ts` | 8 endpoints | Very High | Multi-step workflow, state machines |
| `routes/billing-webhook.ts` | 1 endpoint | Very High | Stripe webhooks, plan changes |
| `routes/waitlist.ts` | 1 endpoint | Low | Simple CRUD |

**Most critical: `billing-webhook.ts`** handles Stripe webhook events that control plan
upgrades/downgrades. A bug here could silently leave orgs on wrong plans or fail to process
payments. Test cases needed:
- Webhook signature verification (valid/invalid/missing)
- Plan determination from subscription status (active, canceled, past_due)
- Enterprise plan preservation (should never downgrade)
- Cache invalidation after plan changes

**Second most critical: `annotations.ts`** has 8 endpoints with a complex item lifecycle
(pending -> claimed -> completed/skipped). Test cases needed:
- Item state transition validation (can't submit a skipped item)
- Claim workflow with JWT auth and userId tracking
- Score creation on submission
- Cascade deletion of queue items

### 4. Auth Plugin (apps/api/src/plugins/auth.ts) - 0% coverage

This is the **core authentication layer** for the entire API. It determines whether requests use
JWT, API key, or no auth based on path matching. Currently untested.

**Recommended tests:**
- Public paths correctly bypass authentication
- JWT routes are handled by the JWT decorator
- API key routes validate and resolve the key to an orgId
- Missing/invalid Bearer tokens return 401
- Request augmentation (orgId, userId, samplingRate) is correct

---

## Priority 2 - Important Gaps

### 5. Notification Dispatcher (packages/notifications/src/dispatcher.ts)

Individual providers (Slack, PagerDuty, GitHub, Linear, Webhook) are well-tested, but the
**dispatcher orchestration** has no tests. The dispatcher handles:
- Rule filtering by enabled status, event type, and severity threshold
- Severity ranking comparison (`SEVERITY_RANK` lookup)
- Error resilience (one failed provider shouldn't block others)

**Recommended tests:**
- Rule matching with various severity/type combinations
- Error isolation: one provider failure doesn't affect others
- Empty rule set handling
- Unknown provider type handling

### 6. Python SDK Client (packages/sdk-py/foxhound/client.py) - 0% coverage, 778 lines

The Python tracer and all 6 integrations are tested, but `client.py` itself (the main entry
point for all Python SDK users) has **zero tests**. It contains:
- HTTP request construction for 25+ API operations
- Status code validation (varies by endpoint: 200, 201, 202, 204)
- Error message formatting with response truncation
- Endpoint normalization and distributed tracing header propagation

**Recommended tests:**
- Request body construction (snake_case to camelCase conversion)
- Status code validation per endpoint
- Error handling and message formatting
- `start_trace()` metadata merging for distributed tracing
- Async context manager lifecycle

### 7. API Client Package (packages/api-client) - 0% coverage, ~650 lines

Used by the CLI, MCP server, and potentially external consumers. Contains:
- HTTPS enforcement for non-localhost endpoints (security-critical)
- `toEpochMs()` utility for timestamp parsing
- URL encoding and query parameter construction for 25+ methods

**Recommended tests:**
- Constructor validation (HTTPS enforcement, trailing slash removal)
- `toEpochMs()` with ISO 8601, epoch-ms strings, and invalid inputs
- Query parameter encoding for search operations

### 8. API Support Files

| File | Lines | What to Test |
|------|-------|-------------|
| `persistence.ts` | ~50 | Retry logic with exponential backoff (100ms, 200ms, 400ms) |
| `lib/pricing-cache.ts` | ~80 | Longest-prefix-match algorithm, cache refresh, org overrides |
| `lib/config-cache.ts` | ~60 | Composite key caching, refresh interval, type conversions |
| `jobs/retention-cleanup.ts` | ~50 | Per-org error isolation, interval management |

---

## Priority 3 - Nice to Have

### 9. CLI Package (packages/cli) - 0% coverage, ~700 lines

The CLI is a user-facing tool but its logic is mostly orchestration of `api-client` calls.
Testing the api-client (Priority 2) covers the core logic. Still valuable:
- `config.ts`: File permission handling (0o700 dir, 0o600 file), env var precedence
- `output.ts`: Table formatting, JSON output mode
- `commands/init.ts`: Interactive setup wizard (most complex command at 184 lines)

### 10. Shared Types Utilities (packages/types/src/index.ts)

The `getBudgetPeriodKey()` and `parsePeriodStart()` functions are also exported from
`packages/types`. These may be duplicated with `packages/db` - if so, testing one covers both.
Worth verifying they stay in sync.

---

## Recommended Action Plan

### Phase 1: Security and correctness foundations
1. Add tests for `packages/db` crypto functions (hashPassword, verifyPassword, generateApiKey)
2. Add tests for budget period utilities (getBudgetPeriodKey, parsePeriodStart)
3. Add tests for `plugins/auth.ts` authentication routing
4. Add tests for `routes/billing-webhook.ts` Stripe webhook handling

### Phase 2: Worker reliability
5. Add Vitest to `apps/worker` and write unit tests for algorithmic functions
6. Add integration tests for evaluator and experiment job processors
7. Add tests for SLA check percentile math and cost monitor threshold logic
8. Add tests for regression detector structural drift algorithm

### Phase 3: SDK and client completeness
9. Add tests for `packages/sdk-py/foxhound/client.py`
10. Add tests for `packages/api-client` (HTTPS enforcement, toEpochMs, query building)
11. Add tests for `packages/notifications/src/dispatcher.ts`

### Phase 4: Remaining API routes and CLI
12. Add tests for `routes/annotations.ts` (complex state machine)
13. Add tests for `routes/scores.ts` and `routes/evaluators.ts`
14. Add tests for `packages/cli/src/config.ts`
