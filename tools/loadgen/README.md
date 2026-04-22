# Foxhound Load-Test Harness

Synthetic load harness for the Foxhound ingest path. Drives `POST /v1/traces/otlp`
with OTLP/HTTP JSON batches at a target RPS, captures latency percentiles,
error rates, and status distribution, and emits a canonical JSON report.

This is WP01 of the [Scale Readiness Program](../../docs/plans/active/2026-04-20-scale-readiness-program/README.md).
Every later WP that changes the ingest path must run these scenarios and
update [`docs/reference/load-tests.md`](../../docs/reference/load-tests.md).

## Install prerequisites

```bash
# Preferred: k6 for scale-grade runs (35k RPS scenarios require k6)
brew install k6                # macOS
# or: sudo apt-get install k6   # Debian/Ubuntu w/ k6 apt repo

# Node fallback (no external tool): built into this package; no install.

# Workspace deps
pnpm install
```

## Run it

```bash
# From the repo root:
export LOAD_TEST_URL=http://localhost:3000
export LOAD_TEST_API_KEY=fh_live_xxx

# Smoke (10 seconds, 50 RPS) — sanity check that the API is reachable.
pnpm load:scale -- --scenario=smoke

# Baseline (5 min, 1k RPS) — the "before" snapshot on the current code path.
pnpm load:scale -- --scenario=baseline

# Burst (5 min, 10k RPS) — surfaces the knee of the current ingest buffer.
pnpm load:scale -- --scenario=burst

# Sustained (30 min, 35k RPS) — the program's target. Expected to fail today.
pnpm load:scale -- --scenario=sustained
```

Each run writes `tools/loadgen/last-run.json` and appends a row to
`docs/reference/load-tests.md` (if the page is present).

## What the harness does

Per request:
1. Generates an OTLP/HTTP JSON body carrying 1 trace × 4 spans (by default) with
   realistic shapes (LLM calls, tool calls, agent steps, workflows).
2. Each span is padded to a target size (default 2 KiB) via a `payload.filler`
   string attribute so the wire weight matches production-like workloads.
3. Requests rotate across 3 synthetic org IDs (`org_a`, `org_b`, `org_c`). The
   harness itself is therefore tenant-mixed — any cross-tenant bug would show
   up as a wrong-org attribution in the server logs.
4. Authentication: `Authorization: Bearer $LOAD_TEST_API_KEY`. All three org
   IDs must be accessible via the key used (or the org scoping must be
   handled by three keys; see `--org-ids=` and future WP18 work).

## Output

`tools/loadgen/last-run.json` — canonical `LoadReport` shape defined in
[`src/report.ts`](./src/report.ts):

```jsonc
{
  "date": "2026-04-20T12:34:56.000Z",
  "scenario": "baseline",
  "tool": "k6",
  "target": { "url": "http://localhost:3000", "endpoint": "/v1/traces/otlp" },
  "durationSec": 300,
  "targetRps": 1000,
  "achievedRps": 998,
  "totalRequests": 299400,
  "totalSpans": 1197600,
  "spansPerRequest": 4,
  "latency": { "p50Ms": 80, "p95Ms": 190, "p99Ms": 310, "maxMs": 500 },
  "errorRate": 0.003,
  "status": { "202": 298500, "500": 900 },
  "orgIds": ["org_a", "org_b", "org_c"],
  "pass": true,
  "passCriteria": "error_rate < 1%; p99 not regressed > 20%"
}
```

## Gate policy

First run on a host is always a **baseline** (pass = true as long as
`errorRate < 1%`). Subsequent runs fail when:

- `errorRate > 1%`
- p99 latency regressed > 20% vs the last green run
- achieved RPS dropped > 15% vs the last green run

CI (`.github/workflows/load-test.yml`) runs the baseline scenario nightly
against a freshly booted API instance and publishes `last-run.json` as a
workflow artifact.

## Tests

```bash
pnpm --filter @foxhound/loadgen test      # vitest unit tests
pnpm --filter @foxhound/loadgen typecheck # tsc strict
```

Unit tests cover:
- Span generator determinism (seeded RNG)
- OTLP shape round-trip stability
- Tenant tag presence on every resource
- Accumulator sampling bounds and error accounting
- k6 summary → `LoadReport` translation
- Default gate predicate (first run, regression, RPS drop)

## Why k6 over vegeta / locust / custom Node

See [RFC-001](../../docs/rfcs/RFC-001-load-testing-methodology.md) for the
full decision record. Summary: k6 gives us JS-scripted scenarios (matching the
repo's TS skill set), constant-arrival-rate executors (vegeta's default shape
is fire-and-forget), built-in summary JSON (which plugs cleanly into our
report writer), and a mature Grafana Cloud / GitHub Actions story for when we
later move load runs off the local laptop.

## k6 not installed?

The CLI auto-detects k6 and falls back to a pure-Node orchestrator that uses
`fetch` + worker loops to reach the target RPS. The Node fallback is intended
for low-RPS smoke runs (≤ 2k) and for environments where k6 cannot be
installed (e.g. locked-down CI agents). It is NOT the gate tool; any scale
claim in the program must be backed by a k6 run.
