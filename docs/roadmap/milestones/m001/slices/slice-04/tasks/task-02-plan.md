---
estimated_steps: 48
estimated_files: 3
skills_used: []
---

# T02: Implement TypeScript OpenTelemetry bridge with tests and packaging

## Description

Create the TypeScript OTel bridge module `packages/sdk/src/integrations/opentelemetry.ts` that implements the OpenTelemetry JS `SpanProcessor` interface to map GenAI semantic convention spans to Foxhound trace spans. This enables instrumentation for Mastra and any future OTel-instrumented TypeScript/JavaScript framework.

The bridge follows the established TypeScript integration pattern from `claude-agent.ts`: tracer instance, factory method `fromClient()`, span lifecycle methods, and `flush()`.

## Steps

1. Create `packages/sdk/src/integrations/opentelemetry.ts` with:
   - `FoxhoundSpanProcessor` class implementing the OTel JS `SpanProcessor` interface (onStart, onEnd, shutdown, forceFlush)
   - `fromClient(client, options)` static factory method (matching `FoxhoundClaudeTracer.fromClient` pattern)
   - `onStart(span, parentContext)` — calls `tracer.startSpan()` mapping OTel span to Fox span, stores in `Map<string, ActiveSpan>`
   - `onEnd(span)` — looks up Fox ActiveSpan, extracts GenAI attributes, calls `span.end()`
   - `semanticToFoxKind(span)` — maps gen_ai.operation.name to SpanKind (same logic as Python bridge)
   - `extractAttributes(span)` — maps GenAI semantic conventions to Fox attributes (same mapping as Python)
   - Use `@opentelemetry/api` types only (peer dependency, not bundled) — import types with `import type` where possible
   - JSDoc documentation with Mastra configuration example

2. Update `packages/sdk/package.json`:
   - Add `@opentelemetry/api` as peerDependency (>=1.4.0) with peerDependenciesMeta marking it optional
   - Add exports entry: `"./integrations/opentelemetry"` pointing to `./dist/integrations/opentelemetry.js` and types

3. Create `packages/sdk/src/integrations/opentelemetry.test.ts` with unit tests:
   - Test onStart + onEnd produce correct Fox span with kind and attributes
   - Test semantic convention mapping for all GenAI operation types
   - Test attribute extraction (model, tokens, prompt)
   - Test prompt truncation at 512 chars
   - Test parent span ID propagation
   - Test error status mapping
   - Test shutdown calls flush
   - Mock OTel span objects as plain objects with the required interface shape (no real @opentelemetry/api import needed)
   - Follow the same test helper pattern as `claude-agent.test.ts` (makeTracer, spansByName)

4. Run tests: `cd packages/sdk && pnpm test -- --grep opentelemetry`

## Must-Haves

- [ ] `FoxhoundSpanProcessor` implements SpanProcessor interface (onStart, onEnd, shutdown, forceFlush)
- [ ] `fromClient()` static factory matches existing pattern
- [ ] GenAI semantic convention mapping matches Python bridge behavior
- [ ] `@opentelemetry/api` declared as optional peer dependency (not bundled)
- [ ] Export path added to package.json
- [ ] All unit tests pass

## Verification

- `cd packages/sdk && pnpm test -- --grep opentelemetry` — all tests pass
- `grep -q 'opentelemetry' packages/sdk/package.json` — peer dep and export entry present

## Inputs

- `packages/sdk/src/tracer.ts` — Tracer, ActiveSpan types used by the bridge
- `packages/sdk/src/client.ts` — FoxhoundClient.startTrace() factory
- `packages/sdk/src/integrations/claude-agent.ts` — reference TypeScript integration pattern
- `packages/sdk/src/integrations/claude-agent.test.ts` — reference test pattern
- `packages/sdk/package.json` — add peer dependency and exports entry
- `packages/sdk-py/foxhound/integrations/opentelemetry.py` — Python bridge for consistent behavior

## Expected Output

- `packages/sdk/src/integrations/opentelemetry.ts` — new OTel bridge module (~200 lines)
- `packages/sdk/src/integrations/opentelemetry.test.ts` — unit tests (~150 lines)
- `packages/sdk/package.json` — updated with peer dep and exports

## Inputs

- `packages/sdk/src/tracer.ts`
- `packages/sdk/src/client.ts`
- `packages/sdk/src/integrations/claude-agent.ts`
- `packages/sdk/src/integrations/claude-agent.test.ts`
- `packages/sdk/package.json`
- `packages/sdk-py/foxhound/integrations/opentelemetry.py`

## Expected Output

- `packages/sdk/src/integrations/opentelemetry.ts`
- `packages/sdk/src/integrations/opentelemetry.test.ts`
- `packages/sdk/package.json`

## Verification

cd packages/sdk && pnpm test -- --grep opentelemetry
