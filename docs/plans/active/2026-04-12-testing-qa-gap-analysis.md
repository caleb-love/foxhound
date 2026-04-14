# Testing & QA Gap Analysis

**Date:** 2026-04-12
**Author:** Claude (automated audit)
**Status:** Resolved — all actionable items fixed

## Current State (after fixes)

- **Tests:** 723 total across 9 packages (all passing)
  - @foxhound/api: 230 tests (20 files)
  - @foxhound/worker: 49 tests (7 files)
  - @foxhound-ai/mcp-server: 137 tests (2 files)
  - @foxhound-ai/sdk: 90 tests (4 files)
  - @foxhound/api-client: 83 tests (1 file)
  - @foxhound/notifications: 51 tests (2 files)
  - @foxhound/db: 50 tests (1 file, skipped without DB)
  - @foxhound/billing: 24 tests (2 files)
  - @foxhound/types: 9 tests (1 file)
- **Frameworks:** Vitest (TS/JS), pytest (Python)
- **CI:** 3 workflows (ci.yml, deploy.yml, publish.yml) — all with test gates
- **Coverage:** Enforced per-package via `@vitest/coverage-v8` with per-package thresholds

---

## Findings & Resolutions

### CRITICAL (all fixed)

#### 1. ~~CI broken — 2 failing tests on main~~ FIXED
Stale Turbo cache was causing false failures. Cleared cache; tests pass.

#### 2. ~~Zero worker test coverage (0/7 queues)~~ FIXED
Added 49 tests across 7 queue test files:
- `evaluator.test.ts` — 21 tests (queue config, processor, DLQ, LLM providers, redaction, consent gate)
- `experiment.test.ts` — 9 tests (e2e success, per-run errors, auto-scoring, edge cases)
- `cost-monitor.test.ts` — 5 tests (budget alerts, skip on null config)
- `cost-reconciler.test.ts` — 3 tests (Redis reconciliation, config filtering)
- `sla-check.test.ts` — 4 tests (compliant, breach, insufficient data)
- `sla-scheduler.test.ts` — 2 tests (enqueue SLA checks)
- `regression-detector.test.ts` — 5 tests (baseline creation, structural drift, skip conditions)

#### 3. ~~Five API route files completely untested~~ FIXED
Added tests for all 5 routes:
- `scores.test.ts` — 10 tests
- `evaluators.test.ts` — 15 tests
- `annotations.test.ts` — 17 tests
- `billing-webhook.test.ts` — 21 tests (Stripe signature validation, subscription lifecycle, invoice failures)
- `waitlist.test.ts` — 4 tests

#### 4. CLI package zero tests
Deferred — CLI is a thin wrapper around the API client. Lower risk.

---

### HIGH (fixed where actionable)

#### 5. ~~No coverage thresholds enforced~~ FIXED
- Installed `@vitest/coverage-v8` in all 9 testable packages
- Created shared config (`vitest.shared.ts`) with 65% default thresholds
- Per-package `vitest.config.ts` with tailored thresholds:
  - billing: 95% stmts, 80% funcs, 85% branches
  - types: 95% stmts, 95% funcs, 85% branches
  - notifications: 80% across the board
  - worker: 80% stmts/lines, 75% branches, 90% funcs
  - sdk: 55% (client.ts wrappers lower average; target 80%)
  - db: 0% (integration tests, DB-dependent)
  - api, api-client, mcp-server: 65% defaults
- CI runs `pnpm test:coverage` to enforce thresholds
- Turbo task `test:coverage` configured

#### 6. ~~Python tests not in CI~~ FIXED
Added `test-python` job to `ci.yml` (Python 3.11, hatch test). Build job now depends on `[lint-typecheck, test, test-python]`.

#### 7. DB integration tests silently skipped in CI
Acknowledged — requires CI Postgres service container. Coverage thresholds set to 0% for db package.

#### 8. No true E2E tests in CI
Deferred — requires infrastructure (real server + DB in CI).

#### 9. ~~Notifications dispatcher untested~~ FIXED
Added `dispatcher.test.ts` — 9 tests covering rule filtering, channel dispatch, send failures, multi-channel routing.

---

### MEDIUM (fixed where actionable)

#### 10. ~~Publish workflow ships without running tests~~ FIXED
Added `test` job to `publish.yml` that gates all three publish jobs (`publish-npm-sdk`, `publish-npm-mcp`, `publish-pypi`) via `needs: [test]`.

#### 11. Test quality concerns
Partially addressed — new tests use proper mock patterns with `vi.hoisted()`. Existing tests unchanged.

#### 12. Missing test categories
Partially addressed — webhook signature tests added in `billing-webhook.test.ts`. Auth/negative tests added across new route tests.

#### 13. ~~`packages/types/` utility functions untested~~ FIXED
Added `index.test.ts` — 9 tests covering `getBudgetPeriodKey()` and `parsePeriodStart()`.

#### 14. Python SDK `cli.py` untested
Deferred — thin CLI wrapper, lower risk.

---

## Coverage Summary (post-fix)

| Package | Stmts | Branch | Funcs | Lines | Threshold |
|---------|-------|--------|-------|-------|-----------|
| types | 100% | 90% | 100% | 100% | 95/85/95/95 |
| billing | 98% | 90% | 86% | 98% | 95/85/80/95 |
| api-client | 86% | 96% | 75% | 86% | 65/70/65/65 |
| mcp-server | 86% | 72% | 100% | 86% | 65/70/65/65 |
| worker | 84% | 77% | 93% | 84% | 80/75/90/80 |
| notifications | 80% | 87% | 96% | 80% | 80/80/90/80 |
| api | 70% | 74% | 69% | 70% | 65/70/65/65 |
| sdk | 58% | 88% | 58% | 58% | 55/85/55/55 |
| db | 26% | 91% | 5% | 26% | 0/0/0/0 |

## Remaining Work (lower priority)

1. Increase SDK coverage to 80% — needs tests for client.ts wrapper methods
2. Increase API coverage to 80% — needs more route handler edge case tests
3. Add CI Postgres for real DB integration tests
4. Add CLI tests
5. Add E2E tests with real server
