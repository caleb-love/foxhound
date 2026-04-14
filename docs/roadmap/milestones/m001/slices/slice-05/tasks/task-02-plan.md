---
estimated_steps: 50
estimated_files: 16
skills_used: []
---

# T02: Import SDK, MCP server, and CI/CD content into Docusaurus pages

## Description

Create all documentation pages by importing and restructuring content from existing READMEs. This is the bulk content task — transform monolithic READMEs into navigable per-topic pages.

**Source content locations (in this worktree):**
- `packages/sdk-py/README.md` — Python SDK: installation, LangGraph quickstart, CrewAI quickstart, manual tracing, OTel bridge (Pydantic AI, Bedrock AgentCore, Google ADK)
- `packages/sdk/README.md` — TypeScript SDK: installation, quickstart, OTel bridge (Mastra)
- `packages/mcp-server/README.md` — MCP server: setup for Claude Code/Cursor/Windsurf, env vars, all tool descriptions

**Quality gate content (NOT in this worktree — write based on S03 summary):**
The GitHub Actions quality gate was built in S03. Key facts for docs:
- Composite action at `.github/actions/quality-gate/`
- 8 inputs: api-key (required), api-endpoint (required), dataset-id (required), evaluator-ids (optional), experiment-name (optional), experiment-config (required JSON), threshold (default 0.0), baseline-experiment-id (optional), timeout (default 600)
- 2 outputs: experiment-id, comparison-url
- Requires `pull-requests: write` permission
- Flow: creates experiment → polls with exponential backoff → compares scores → posts PR comment → fails if below threshold
- Example workflow trigger: `pull_request` on main branch

## Steps

1. **Getting Started section** — Create `docs-site/docs/getting-started/` with:
   - `installation.md` — Install instructions for Python SDK (`pip install foxhound-ai` with extras) and TypeScript SDK (`npm install @foxhound-ai/sdk`). Include MCP server install for IDE users.
   - `quickstart.md` — First trace example for both Python (manual tracing from Python README) and TypeScript (from TS README). Keep it simple — one language, one trace, flush.
   - `first-trace.md` — Viewing traces in Foxhound UI, understanding span trees, using `foxhound ui`.

2. **SDK Reference section** — Create `docs-site/docs/sdk/` with:
   - `typescript.md` — Full TypeScript SDK reference. Copy content from `packages/sdk/README.md`: installation, quickstart, OTel bridge section.
   - `python.md` — Full Python SDK reference. Copy content from `packages/sdk-py/README.md`: installation, all quickstart variants, OTel bridge section, all framework examples.

3. **Integrations section** — Create `docs-site/docs/integrations/` with per-framework pages:
   - `langgraph.md` — Extract LangGraph content from Python README (FoxCallbackHandler pattern)
   - `crewai.md` — Extract CrewAI content from Python README (FoxCrewTracer pattern, sync + async)
   - `mastra.md` — Extract Mastra content from TypeScript README (OTel bridge pattern)
   - `pydantic-ai.md` — Extract Pydantic AI content from Python README (OTel bridge, instrument=True)
   - `bedrock-agentcore.md` — Extract Bedrock content from Python README (configure_adot_for_foxhound helper)
   - `google-adk.md` — Extract Google ADK content from Python README (OTel bridge pattern)
   - `opentelemetry-bridge.md` — Overview page explaining the OTel bridge concept, linking to both SDK bridge implementations

4. **MCP Server section** — Create `docs-site/docs/mcp-server/` with:
   - `setup.md` — IDE setup instructions from MCP README: Claude Code, Cursor/Windsurf config JSON, env vars table
   - `tools.md` — All 30 MCP tools grouped by category. Use the tool names and descriptions from `packages/mcp-server/src/index.ts`. Group into: Trace Querying (search_traces, get_trace, replay_span, diff_runs), Analysis (get_anomalies, explain_failure, suggest_fix), Scoring (score_trace, get_trace_scores), Evaluators (list_evaluators, run_evaluator, get_evaluator_run), Datasets (list_datasets, add_trace_to_dataset, curate_dataset), Alerts (list_alert_rules, create_alert_rule, delete_alert_rule, list_channels, create_channel, test_channel, delete_channel), Keys & Budget (list_api_keys, create_api_key, revoke_api_key, get_agent_budget, get_cost_summary), SLA & Baselines (check_sla_status, detect_regression, list_baselines, status)

5. **CI/CD section** — Create `docs-site/docs/ci-cd/` with:
   - `quality-gate.md` — Document the quality gate action based on S03 summary. Include: overview, inputs table (8 inputs), outputs table (2 outputs), permissions needed, example workflow YAML, how it works (create experiment → poll → compare → comment → enforce), troubleshooting tips.

6. **Update `docs-site/sidebars.ts`** to reference all new page paths.

7. **Verify build** — `pnpm --filter @foxhound-ai/docs build` exits 0 with all pages rendering.

## Must-Haves

- [ ] Getting Started section has installation, quickstart, and first-trace pages
- [ ] SDK section has TypeScript and Python reference pages with complete content from READMEs
- [ ] Integrations section has per-framework pages for all 6 frameworks plus OTel bridge overview
- [ ] MCP server section has setup page and categorized tool reference
- [ ] CI/CD section has quality gate documentation with inputs table and example workflow
- [ ] Sidebar navigation updated to include all pages
- [ ] `pnpm --filter @foxhound-ai/docs build` exits 0

## Verification

- `pnpm --filter @foxhound-ai/docs build` exits 0
- `find docs-site/docs -name '*.md' | wc -l` returns >= 16 (landing + 3 getting-started + 2 sdk + 7 integrations + 2 mcp + 1 cicd)
- `test -f docs-site/docs/sdk/typescript.md && test -f docs-site/docs/sdk/python.md`
- `test -f docs-site/docs/mcp-server/tools.md`

## Inputs

- `docs-site/package.json`
- `docs-site/docusaurus.config.ts`
- `docs-site/sidebars.ts`
- `docs-site/docs/index.md`
- `packages/sdk-py/README.md`
- `packages/sdk/README.md`
- `packages/mcp-server/README.md`
- `packages/mcp-server/src/index.ts`

## Expected Output

- `docs-site/docs/getting-started/installation.md`
- `docs-site/docs/getting-started/quickstart.md`
- `docs-site/docs/getting-started/first-trace.md`
- `docs-site/docs/sdk/typescript.md`
- `docs-site/docs/sdk/python.md`
- `docs-site/docs/integrations/langgraph.md`
- `docs-site/docs/integrations/crewai.md`
- `docs-site/docs/integrations/mastra.md`
- `docs-site/docs/integrations/pydantic-ai.md`
- `docs-site/docs/integrations/bedrock-agentcore.md`
- `docs-site/docs/integrations/google-adk.md`
- `docs-site/docs/integrations/opentelemetry-bridge.md`
- `docs-site/docs/mcp-server/setup.md`
- `docs-site/docs/mcp-server/tools.md`
- `docs-site/docs/ci-cd/quality-gate.md`
- `docs-site/sidebars.ts`

## Verification

pnpm --filter @foxhound-ai/docs build && find docs-site/docs -name '*.md' | wc -l | grep -q '[1-9][0-9]'
