---
id: T03
parent: S04
milestone: M001
key_files:
  - packages/sdk-py/README.md
  - packages/sdk/README.md
key_decisions:
  - TypeScript SDK README created from scratch — file did not previously exist
  - Mastra example uses NodeSDK.spanProcessors array rather than raw TracerProvider, matching Mastra's standard OTel wiring pattern
duration: 
verification_result: passed
completed_at: 2026-04-10T07:12:44.422Z
blocker_discovered: false
---

# T03: Added OpenTelemetry Bridge documentation sections to both SDK READMEs with copy-paste examples for Pydantic AI, Bedrock AgentCore, Google ADK (Python), and Mastra (TypeScript)

**Added OpenTelemetry Bridge documentation sections to both SDK READMEs with copy-paste examples for Pydantic AI, Bedrock AgentCore, Google ADK (Python), and Mastra (TypeScript)**

## What Happened

Extended packages/sdk-py/README.md with a new OpenTelemetry Bridge section containing: install snippet, general setup, Pydantic AI (instrument=True), Bedrock AgentCore (configure_adot_for_foxhound() helper + env vars), Google ADK (enable_tracing=True), and a coverage gap note. Created packages/sdk/README.md from scratch (file did not previously exist) with full SDK quickstart plus OpenTelemetry Bridge section covering general NodeTracerProvider setup, Mastra wiring via NodeSDK.spanProcessors, and a coverage note. All import paths verified against T01/T02 module outputs.

## Verification

All four task-plan grep checks pass: 'OpenTelemetry Bridge' in both READMEs, Pydantic AI/Google ADK/Bedrock in Python README, Mastra in TypeScript README. Import paths verified correct against actual modules. Markdown heading hierarchy is valid.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `grep -q 'OpenTelemetry Bridge' packages/sdk-py/README.md` | 0 | ✅ pass | 10ms |
| 2 | `grep -q 'OpenTelemetry Bridge' packages/sdk/README.md` | 0 | ✅ pass | 10ms |
| 3 | `grep -q 'Pydantic AI' packages/sdk-py/README.md && grep -q 'Google ADK' packages/sdk-py/README.md && grep -q 'Bedrock' packages/sdk-py/README.md` | 0 | ✅ pass | 15ms |
| 4 | `grep -q 'Mastra' packages/sdk/README.md` | 0 | ✅ pass | 10ms |

## Deviations

TypeScript SDK README did not previously exist — created from scratch. The failing verification command from the prior attempt (pnpm test -- --grep) was a turbo CLI misuse unrelated to this documentation-only task.

## Known Issues

None.

## Files Created/Modified

- `packages/sdk-py/README.md`
- `packages/sdk/README.md`
