# S05: Documentation Site

**Goal:** Docusaurus 3 documentation site at docs-site/ with getting started guides, SDK reference (TypeScript + Python), MCP server reference, CI/CD quality gate reference, integration guides, and evaluation cookbook — all built from existing source content
**Demo:** docs.foxhound.dev live with getting started guides, API reference, SDK reference, evaluation cookbook

## Must-Haves

- `pnpm --filter docs-site build` exits 0 with `docs-site/build/` populated; sidebar navigation shows all 6 sections (Getting Started, SDKs, MCP Server, Integrations, CI/CD, Evaluation Cookbook); all internal links resolve without broken-link warnings; GitHub Pages deploy workflow exists at `.github/workflows/docs.yml`

## Proof Level

- This slice proves: This slice proves: final-assembly (documentation site is the last deliverable of M001). Real runtime required: no (static site build only). Human/UAT required: no.

## Integration Closure

Upstream surfaces consumed: `packages/sdk-py/README.md` (Python SDK content), `packages/sdk/README.md` (TypeScript SDK content), `packages/mcp-server/README.md` (MCP tools reference), S03 quality gate action docs (from summary — files not in worktree). New wiring: `docs-site` added to `pnpm-workspace.yaml`, GitHub Pages deploy workflow. What remains: DNS CNAME for docs.foxhound.dev (manual, outside code scope).

## Verification

- Not provided.

## Tasks

- [x] **T01: Scaffold Docusaurus 3 app with workspace integration** `est:45m`
  ## Description

Create the `docs-site/` Docusaurus 3 application from scratch — package.json, docusaurus.config.ts, sidebars.ts, tsconfig.json, landing page, and workspace wiring. This unblocks all content tasks.

## Steps

1. Create `docs-site/package.json` with Docusaurus 3 dependencies: `@docusaurus/core@3.x`, `@docusaurus/preset-classic@3.x`, `@docusaurus/module-type-aliases@3.x`, `@easyops-cn/docusaurus-search-local` for search, React 18, and scripts (`start`, `build`, `clear`, `serve`). Set `name: "@foxhound-ai/docs"`, `private: true`.

2. Create `docs-site/docusaurus.config.ts` with:
   - `title: "Foxhound Docs"`, `tagline: "Compliance-grade observability for AI agent fleets"`
   - `url: "https://docs.foxhound.dev"`, `baseUrl: "/"`
   - `organizationName: "caleb-love"`, `projectName: "foxhound"`
   - Navbar with logo, title "Foxhound", links to Getting Started, API Reference, GitHub
   - Footer with links column and MIT copyright
   - `@docusaurus/preset-classic` with docs as default route (`routeBasePath: "/"`)
   - Theme config with `@easyops-cn/docusaurus-search-local` plugin
   - **Use TypeScript config format** (Docusaurus 3 supports `.ts` natively)

3. Create `docs-site/sidebars.ts` with sidebar structure:
   ```
   getting-started/ (Installation, Quickstart, First Trace)
   sdk/ (TypeScript SDK, Python SDK)
   integrations/ (LangGraph, CrewAI, Mastra, Pydantic AI, Bedrock AgentCore, Google ADK, OpenTelemetry Bridge)
   mcp-server/ (Setup, Tool Reference)
   ci-cd/ (Quality Gate Action)
   evaluation-cookbook/ (Manual Scoring, LLM-as-a-Judge, Dataset Curation, CI Quality Gates)
   ```

4. Create `docs-site/tsconfig.json` with Docusaurus-compatible settings.

5. Create `docs-site/docs/index.md` as the landing page with brief intro and links to each section.

6. Create `docs-site/static/` directory with `CNAME` file containing `docs.foxhound.dev` and copy `docs-site/static/img/` placeholder (use a simple text-based logo.svg or reference `.github/logo.svg`).

7. Create `docs-site/.npmrc` with `shamefully-hoist=true` (required for Docusaurus peer deps in pnpm).

8. Add `"docs-site"` to `pnpm-workspace.yaml` packages array.

9. Run `pnpm install` from the worktree root to install docs-site dependencies.

10. Verify: `pnpm --filter @foxhound-ai/docs build` exits 0 (with just the landing page).

## Must-Haves

- [ ] `docs-site/package.json` has Docusaurus 3 deps and build/start/serve scripts
- [ ] `docs-site/docusaurus.config.ts` configures site with correct url/baseUrl for docs.foxhound.dev
- [ ] `docs-site/sidebars.ts` defines all 6 navigation sections (skeleton — content pages added in T02/T03)
- [ ] `docs-site` added to `pnpm-workspace.yaml`
- [ ] `pnpm --filter @foxhound-ai/docs build` exits 0

## Verification

- `pnpm --filter @foxhound-ai/docs build` exits 0
- `test -f docs-site/build/index.html` passes
- `grep -q 'docs-site' pnpm-workspace.yaml` passes
  - Files: `docs-site/package.json`, `docs-site/docusaurus.config.ts`, `docs-site/sidebars.ts`, `docs-site/tsconfig.json`, `docs-site/docs/index.md`, `docs-site/static/CNAME`, `docs-site/.npmrc`, `pnpm-workspace.yaml`
  - Verify: pnpm --filter @foxhound-ai/docs build && test -f docs-site/build/index.html && grep -q 'docs-site' pnpm-workspace.yaml

- [x] **T02: Import SDK, MCP server, and CI/CD content into Docusaurus pages** `est:1h30m`
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
  - Files: `docs-site/docs/getting-started/installation.md`, `docs-site/docs/getting-started/quickstart.md`, `docs-site/docs/getting-started/first-trace.md`, `docs-site/docs/sdk/typescript.md`, `docs-site/docs/sdk/python.md`, `docs-site/docs/integrations/langgraph.md`, `docs-site/docs/integrations/crewai.md`, `docs-site/docs/integrations/mastra.md`, `docs-site/docs/integrations/pydantic-ai.md`, `docs-site/docs/integrations/bedrock-agentcore.md`, `docs-site/docs/integrations/google-adk.md`, `docs-site/docs/integrations/opentelemetry-bridge.md`, `docs-site/docs/mcp-server/setup.md`, `docs-site/docs/mcp-server/tools.md`, `docs-site/docs/ci-cd/quality-gate.md`, `docs-site/sidebars.ts`
  - Verify: pnpm --filter @foxhound-ai/docs build && find docs-site/docs -name '*.md' | wc -l | grep -q '[1-9][0-9]'

- [x] **T03: Write evaluation cookbook and add GitHub Pages deploy workflow** `est:1h`
  ## Description

Create the evaluation cookbook (the only section without a direct source file) and the GitHub Pages deployment workflow. The cookbook synthesizes content from S01 MCP tool descriptions (scoring, evaluators, datasets) and S03 quality gate patterns into practical how-to guides.

## Steps

1. **Evaluation Cookbook section** — Create `docs-site/docs/evaluation-cookbook/` with:
   - `index.md` — Overview page explaining Foxhound's evaluation philosophy: manual scoring for quick feedback, LLM-as-a-Judge evaluators for automated assessment, dataset curation for test suites, CI quality gates for regression prevention.
   - `manual-scoring.md` — How to score traces from your IDE using `foxhound_score_trace` and `foxhound_get_trace_scores` MCP tools. Cover: numeric scores (0-1), categorical labels, comments, trace-level vs span-level scoring, the preview/confirm pattern. Reference the MCP server tools page.
   - `llm-as-judge.md` — How to set up and run LLM-as-a-Judge evaluators. Cover: listing evaluators (`foxhound_list_evaluators`), triggering runs (`foxhound_run_evaluator`) with 1-50 trace IDs, checking status with polling (`foxhound_get_evaluator_run`), understanding async execution (⏳→✅/❌), viewing resulting scores.
   - `dataset-curation.md` — How to build evaluation datasets from production traces. Cover: manual addition (`foxhound_add_trace_to_dataset` with preview/confirm), bulk curation by score thresholds (`foxhound_curate_dataset` with score_name, operator, threshold, since_days, limit), sourceTraceId lineage tracking.
   - `ci-quality-gates.md` — How to automate quality gates in CI. Cover: the GitHub Action flow (create experiment → poll → compare → comment → enforce), setting up baseline experiments, configuring thresholds, example workflow. Cross-reference the CI/CD quality gate reference page.

2. **Update `docs-site/sidebars.ts`** to include all cookbook pages in the evaluation-cookbook section.

3. **Create `.github/workflows/docs.yml`** — GitHub Actions workflow for deploying to GitHub Pages:
   - Trigger on push to `main` when `docs-site/**` changes
   - Use `actions/checkout@v4`, `pnpm/action-setup@v4`, `actions/setup-node@v4`
   - Install deps with `pnpm install --frozen-lockfile`
   - Build with `pnpm --filter @foxhound-ai/docs build`
   - Deploy using `actions/upload-pages-artifact@v3` + `actions/deploy-pages@v4`
   - Set `permissions: pages: write, id-token: write`

4. **Verify:** Full site builds cleanly with all sections including cookbook.

## Must-Haves

- [ ] Evaluation cookbook has 5 pages: overview, manual scoring, LLM-as-a-Judge, dataset curation, CI quality gates
- [ ] Cookbook content is practical and references specific MCP tool names
- [ ] GitHub Pages deploy workflow exists at `.github/workflows/docs.yml`
- [ ] Sidebar includes cookbook section
- [ ] `pnpm --filter @foxhound-ai/docs build` exits 0 with complete site

## Verification

- `pnpm --filter @foxhound-ai/docs build` exits 0
- `find docs-site/docs/evaluation-cookbook -name '*.md' | wc -l` returns >= 5
- `test -f .github/workflows/docs.yml`
- `grep -q 'foxhound_score_trace' docs-site/docs/evaluation-cookbook/manual-scoring.md`
- `grep -q 'deploy-pages' .github/workflows/docs.yml`
  - Files: `docs-site/docs/evaluation-cookbook/index.md`, `docs-site/docs/evaluation-cookbook/manual-scoring.md`, `docs-site/docs/evaluation-cookbook/llm-as-judge.md`, `docs-site/docs/evaluation-cookbook/dataset-curation.md`, `docs-site/docs/evaluation-cookbook/ci-quality-gates.md`, `docs-site/sidebars.ts`, `.github/workflows/docs.yml`
  - Verify: pnpm --filter @foxhound-ai/docs build && find docs-site/docs/evaluation-cookbook -name '*.md' | wc -l | grep -q '[5-9]' && test -f .github/workflows/docs.yml

## Files Likely Touched

- docs-site/package.json
- docs-site/docusaurus.config.ts
- docs-site/sidebars.ts
- docs-site/tsconfig.json
- docs-site/docs/index.md
- docs-site/static/CNAME
- docs-site/.npmrc
- pnpm-workspace.yaml
- docs-site/docs/getting-started/installation.md
- docs-site/docs/getting-started/quickstart.md
- docs-site/docs/getting-started/first-trace.md
- docs-site/docs/sdk/typescript.md
- docs-site/docs/sdk/python.md
- docs-site/docs/integrations/langgraph.md
- docs-site/docs/integrations/crewai.md
- docs-site/docs/integrations/mastra.md
- docs-site/docs/integrations/pydantic-ai.md
- docs-site/docs/integrations/bedrock-agentcore.md
- docs-site/docs/integrations/google-adk.md
- docs-site/docs/integrations/opentelemetry-bridge.md
- docs-site/docs/mcp-server/setup.md
- docs-site/docs/mcp-server/tools.md
- docs-site/docs/ci-cd/quality-gate.md
- docs-site/docs/evaluation-cookbook/index.md
- docs-site/docs/evaluation-cookbook/manual-scoring.md
- docs-site/docs/evaluation-cookbook/llm-as-judge.md
- docs-site/docs/evaluation-cookbook/dataset-curation.md
- docs-site/docs/evaluation-cookbook/ci-quality-gates.md
- .github/workflows/docs.yml
