---
estimated_steps: 32
estimated_files: 2
skills_used: []
---

# T03: Add per-framework configuration examples to Python and TypeScript READMEs

## Description

Add documentation examples to both SDK READMEs showing how to wire the OTel bridge for each of the four target frameworks: Pydantic AI, Amazon Bedrock AgentCore, and Google ADK (Python SDK README), and Mastra (TypeScript SDK README). Each example should be a self-contained code block that users can copy-paste.

## Steps

1. Add to `packages/sdk-py/README.md` an 'OpenTelemetry Bridge' section with:
   - General usage example showing `FoxhoundSpanProcessor.from_client()` + `TracerProvider` setup
   - **Pydantic AI** example: configure TracerProvider with FoxhoundSpanProcessor, create Agent with `instrument=True`
   - **Amazon Bedrock AgentCore** example: show `configure_adot_for_foxhound()` helper usage with env vars
   - **Google ADK** example: show `AdkApp(enable_tracing=True)` with TracerProvider configuration
   - Note on semantic convention coverage gap vs callback-based integrations

2. Add to `packages/sdk/README.md` an 'OpenTelemetry Bridge' section with:
   - General usage example showing `FoxhoundSpanProcessor.fromClient()` + TracerProvider setup
   - **Mastra** example: show Mastra telemetry config with OTLP export pointing to Foxhound, plus SpanProcessor wiring
   - Note that any TypeScript framework emitting OTel GenAI spans works with this bridge

3. Verify documentation renders correctly (no broken markdown).

## Must-Haves

- [ ] Python README has OpenTelemetry Bridge section with Pydantic AI, Bedrock AgentCore, and Google ADK examples
- [ ] TypeScript README has OpenTelemetry Bridge section with Mastra example
- [ ] All code examples use correct import paths matching the actual module structure
- [ ] Coverage gap note included for OTel vs callback-based integrations

## Verification

- `grep -q 'OpenTelemetry Bridge' packages/sdk-py/README.md` — section exists in Python README
- `grep -q 'OpenTelemetry Bridge' packages/sdk/README.md` — section exists in TypeScript README
- `grep -q 'Pydantic AI' packages/sdk-py/README.md && grep -q 'Google ADK' packages/sdk-py/README.md && grep -q 'Bedrock' packages/sdk-py/README.md` — all three Python framework examples present
- `grep -q 'Mastra' packages/sdk/README.md` — Mastra example present in TypeScript README

## Inputs

- `packages/sdk-py/README.md` — existing Python SDK README to extend
- `packages/sdk/README.md` — existing TypeScript SDK README to extend
- `packages/sdk-py/foxhound/integrations/opentelemetry.py` — verify import paths match actual module
- `packages/sdk/src/integrations/opentelemetry.ts` — verify import paths match actual module

## Expected Output

- `packages/sdk-py/README.md` — updated with OpenTelemetry Bridge section and per-framework examples
- `packages/sdk/README.md` — updated with OpenTelemetry Bridge section and Mastra example

## Inputs

- `packages/sdk-py/README.md`
- `packages/sdk/README.md`
- `packages/sdk-py/foxhound/integrations/opentelemetry.py`
- `packages/sdk/src/integrations/opentelemetry.ts`

## Expected Output

- `packages/sdk-py/README.md`
- `packages/sdk/README.md`

## Verification

grep -q 'OpenTelemetry Bridge' packages/sdk-py/README.md && grep -q 'OpenTelemetry Bridge' packages/sdk/README.md && grep -q 'Pydantic AI' packages/sdk-py/README.md && grep -q 'Mastra' packages/sdk/README.md
