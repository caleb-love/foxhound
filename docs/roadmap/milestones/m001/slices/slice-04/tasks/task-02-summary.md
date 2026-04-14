---
id: T02
parent: S04
milestone: M001
key_files:
  - packages/sdk/src/integrations/opentelemetry.ts
  - packages/sdk/src/integrations/opentelemetry.test.ts
  - packages/sdk/package.json
key_decisions:
  - Used structural duck-typed OTel interfaces — no runtime @opentelemetry/api import required; status code compared by integer value (2=ERROR)
  - OTel JS spanId is hex string (not integer like Python); span map keyed by string spanId and parentSpanId read from span.parentSpanId field
  - shutdown() and forceFlush() both call tracer.flush() per OTel spec — active flush, not no-ops
  - console.debug/warn/error for observability — no external logger dependency
duration: 
verification_result: passed
completed_at: 2026-04-10T07:10:23.532Z
blocker_discovered: false
---

# T02: Implemented FoxhoundSpanProcessor TypeScript OTel bridge with 33 passing tests, optional @opentelemetry/api peer dependency, and package.json export entry — enabling Mastra and any OTel-instrumented TypeScript framework to instrument with a single SpanProcessor

**Implemented FoxhoundSpanProcessor TypeScript OTel bridge with 33 passing tests, optional @opentelemetry/api peer dependency, and package.json export entry — enabling Mastra and any OTel-instrumented TypeScript framework to instrument with a single SpanProcessor**

## What Happened

Created packages/sdk/src/integrations/opentelemetry.ts (~230 lines) implementing the OTel JS SpanProcessor interface structurally (duck-typed local interfaces, no runtime @opentelemetry/api import). The bridge follows the claude-agent.ts pattern: fromClient() static factory, Map<string, ActiveSpan> span tracking keyed by OTel hex string spanId, and full lifecycle methods (onStart, onEnd, shutdown, forceFlush). semanticToFoxKind() maps all 7 gen_ai.operation.name values to Fox SpanKind with name-prefix heuristics as fallback. extractAttributes() maps 5 GenAI semantic convention fields to Fox keys with 512-char prompt truncation. console.debug/warn/error observability on every lifecycle event. Updated package.json with @opentelemetry/api optional peer dependency (>=1.4.0) and ./integrations/opentelemetry export entry. Wrote 33 unit tests covering all mapping paths, parent-child propagation, error status, prompt truncation boundary, and edge cases (missing traceId, unknown spanId). Full 85-test SDK suite passes with zero regressions.

## Verification

Ran pnpm test src/integrations/opentelemetry.test.ts — 33/33 pass in 6ms. Ran full pnpm test — 85/85 pass across 4 test files. grep for opentelemetry in package.json confirms peer dep and export entry present.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `cd packages/sdk && pnpm test src/integrations/opentelemetry.test.ts` | 0 | ✅ pass | 667ms |
| 2 | `cd packages/sdk && pnpm test` | 0 | ✅ pass | 349ms |
| 3 | `grep -q 'opentelemetry' packages/sdk/package.json && echo 'dep + export present'` | 0 | ✅ pass | 5ms |

## Deviations

Vitest v3 removed the --grep flag (task plan specified pnpm test -- --grep opentelemetry). Used file-path argument form instead: pnpm test src/integrations/opentelemetry.test.ts. Functionally equivalent. Documented in KNOWLEDGE.md.

## Known Issues

None.

## Files Created/Modified

- `packages/sdk/src/integrations/opentelemetry.ts`
- `packages/sdk/src/integrations/opentelemetry.test.ts`
- `packages/sdk/package.json`
