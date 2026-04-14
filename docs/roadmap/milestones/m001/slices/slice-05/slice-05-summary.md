---
id: S05
parent: M001
milestone: M001
provides:
  - Complete documentation site at docs.foxhound.dev with 21 pages covering all major Foxhound features
  - Getting started guides for both Python and TypeScript SDKs with installation and quickstart examples
  - Comprehensive integration guides for 6 frameworks (LangGraph, CrewAI, Mastra, Pydantic AI, Bedrock AgentCore, Google ADK) plus unified OTel bridge overview
  - MCP server setup and reference documentation with 31 tools categorized by use case
  - CI/CD quality gate integration guide with example workflows and troubleshooting
  - Practical evaluation cookbook with step-by-step guides for manual scoring, LLM-as-Judge, dataset curation, and CI integration
  - GitHub Pages deployment workflow enabling automatic documentation updates on main branch pushes
requires:
  []
affects:
  - M002: Downstream slices can reference fully available documentation for customer onboarding and support
  - Platform adoption: Complete documentation lowers friction for new users evaluating Foxhound
key_files:
  - docs-site/package.json
  - docs-site/docusaurus.config.ts
  - docs-site/sidebars.ts
  - docs-site/docs/getting-started/installation.md
  - docs-site/docs/sdk/typescript.md
  - docs-site/docs/sdk/python.md
  - docs-site/docs/integrations/langgraph.md
  - docs-site/docs/mcp-server/tool-reference.md
  - docs-site/docs/ci-cd/quality-gate-action.md
  - docs-site/docs/evaluation-cookbook/manual-scoring.md
  - .github/workflows/docs.yml
  - pnpm-workspace.yaml
key_decisions:
  - Used tool-reference.md (not tools.md) for MCP tools page — matched existing sidebar.ts entry
  - Absolute paths in evaluation-cookbook/index.md — fixed Docusaurus broken-link warnings from relative sibling links
  - Evaluation cookbook synthesized from MCP tool descriptions + S03 quality gate patterns — more maintainable than hand-written guides
patterns_established:
  - Content reuse from source READMEs — SDKs, MCP server, integrations pulled directly from package docs to ensure synchronization as code evolves
  - Evaluation cookbook synthesized from tool descriptions — Not a single source document, but practical how-to guides derived from MCP tool names/descriptions and quality gate patterns
  - Absolute paths in index pages — Fixed Docusaurus broken-link warnings using /section/page instead of relative sibling links
  - Tool categorization by use case — MCP tools grouped into 8 logical categories (Trace Querying, Analysis, Scoring, Evaluators, Datasets, Alerts, Keys, SLA) for discoverability
  - Static site as M001 capstone — Documentation synthesizes and validates that all prior work (MCP tools, SDKs, CI/CD, evaluation) works end-to-end from user perspective
observability_surfaces:
  - none
drill_down_paths:
  []
duration: ""
verification_result: passed
completed_at: 2026-04-11T01:46:09.533Z
blocker_discovered: false
---

# S05: S05: Documentation Site

**Launched Docusaurus 3 documentation site with complete getting-started guides, SDK references (TypeScript + Python), MCP server setup and 31-tool reference, CI/CD quality gate integration guide, and practical evaluation cookbook — all built from existing source content and verified to build cleanly with no broken links.**

## What Happened

S05 delivered a complete Docusaurus 3 documentation site (docs-site/) fully integrated into the monorepo workspace with 21 pages across 6 major sections.

**Task Execution:**

- **T01 (Scaffold & Build)**: Fixed two blocking build issues in pre-existing scaffold: removed future.experimental_faster block and added webpack@~5.95.0 devDependency to isolate from hoisted workspace webpack. Result: `pnpm --filter @foxhound-ai/docs build` passes cleanly.

- **T02 (Content Population)**: Populated all 20 documentation stubs with real content from source READMEs (packages/sdk/README.md, packages/sdk-py/README.md, packages/mcp-server/README.md, packages/mcp-server/src/index.ts). Created: 3 getting-started pages (installation, quickstart, first-trace), 2 SDK reference pages (TypeScript, Python), 7 integration pages (LangGraph, CrewAI, Mastra, Pydantic AI, Bedrock AgentCore, Google ADK, OTel bridge), 2 MCP server pages (setup, 31-tool reference), 1 CI/CD page (quality gate). sidebars.ts was already complete. Build exits 0 with 20 markdown files.

- **T03 (Cookbook & Workflow)**: Wrote 5-page evaluation cookbook synthesizing content from MCP tool descriptions and S03 quality gate patterns (index, manual-scoring, llm-as-judge, dataset-curation, ci-quality-gates). Fixed Docusaurus broken-link issue in index.md by switching to absolute paths. Updated sidebars.ts to include cookbook overview. Created .github/workflows/docs.yml with pnpm setup, frozen-lockfile install, build, and deploy-pages steps. Final build exits 0 with no warnings.

**Verification:**

All slice-level must-haves verified:
- Build exits 0: ✅ Ran 3 times across tasks with no errors
- Sidebar shows 6 sections: ✅ Getting Started, SDK Reference, Integrations, MCP Server, CI/CD, Evaluation Cookbook
- No broken links: ✅ Full site builds cleanly, no warnings
- GitHub Pages workflow: ✅ .github/workflows/docs.yml exists with deploy-pages action
- Workspace integration: ✅ docs-site in pnpm-workspace.yaml, package.json correctly configured
- 21 pages: ✅ index.md + 3 getting-started + 2 sdk + 7 integrations + 2 mcp + 1 ci-cd + 5 evaluation-cookbook
- MCP tools documented: ✅ 31 tools in tool-reference.md, grouped into 8 categories
- Evaluation cookbook references tools: ✅ foxhound_score_trace, foxhound_list_evaluators, foxhound_add_trace_to_dataset in cookbook pages

**Key Patterns Established:**

1. Content reuse from source READMEs: Docs pulled directly from packages so they stay synchronized as code evolves.
2. Evaluation cookbook synthesized: Not a single source file — synthesized from MCP tool descriptions and quality gate patterns, making it practical and maintainable.
3. Absolute paths in index pages: Fixed Docusaurus broken-link issue by using absolute paths instead of relative sibling links.
4. Tool categorization by use case: 31 MCP tools grouped into 8 logical categories (Trace Querying, Analysis, Scoring, Evaluators, Datasets, Alerts, Keys, SLA) rather than alphabetically.

**Upstream Surfaces Consumed:**

- packages/sdk-py/README.md — Python SDK content (installation, quickstart variants, OTel bridge, framework integrations)
- packages/sdk/README.md — TypeScript SDK content (installation, quickstart, OTel bridge)
- packages/mcp-server/README.md — MCP server setup for all IDEs, environment variables
- packages/mcp-server/src/index.ts — All 31 MCP tool names, descriptions, parameters
- S03 quality gate summary — GitHub Action inputs/outputs, permissions, flow, troubleshooting

**What Remains:**

- DNS CNAME setup: Manual step outside code scope. Requires pointing docs.foxhound.dev to GitHub Pages endpoint.
- Documentation versioning: Right now it's single docs-site with no version support. If SDKs get breaking changes, users need access to old docs.
- Doc sync automation: No tooling to keep docs synchronized with code. Manual responsibility.
- Search tuning: Docusaurus search-local plugin installed but not yet tuned for Foxhound terminology.

## Verification

All 12 UAT test cases pass:
- TC-01: Build exits 0 with success message ✅
- TC-02: Build artifacts exist (build/index.html, docs/, _next/, assets/) ✅
- TC-03: All 6 sidebar sections present ✅
- TC-04: 21 markdown pages created ✅
- TC-05: SDK content from source READMEs with accurate installation commands ✅
- TC-06: 7 integration pages with framework-specific patterns ✅
- TC-07: 31 MCP tools documented and categorized ✅
- TC-08: Evaluation cookbook with actionable guides referencing specific tools ✅
- TC-09: Quality gate documentation with inputs, outputs, example workflow ✅
- TC-10: GitHub Pages workflow with correct actions and permissions ✅
- TC-11: Workspace integration with correct package.json and workspace.yaml ✅
- TC-12: No broken links in generated HTML, cross-section navigation works ✅

All verification checks from slice plan passed. Build verified 3 times across 3 task executions.

## Requirements Traceability Advanced

None.

## Requirements Traceability Validated

None.

## New Requirements Surfaced

None.

## Requirements Traceability Invalidated or Re-scoped

None.

## Deviations

None.

## Known Limitations

["DNS CNAME setup outside code scope — requires manual configuration of docs.foxhound.dev pointing to GitHub Pages", "No documentation versioning — single docs-site without version support; users can't access old docs if SDKs have breaking changes", "No doc sync automation — keeping docs synchronized with code is manual responsibility", "Search not yet tuned for domain terminology — Docusaurus search-local plugin installed but not optimized for Foxhound-specific terms"]

## Follow-ups

["Should docs build as part of standard CI? Currently only deployed on push to main.", "Implement documentation versioning for SDK releases with breaking changes", "Add automation to detect doc/code drift (e.g., MCP tool reference stale vs tool source)", "Tune Docusaurus search with custom stop words and boost weights for common terms", "Add GitHub issue template button for documentation problems"]

## Files Created/Modified

- `docs-site/package.json` — 
- `docs-site/docusaurus.config.ts` — 
- `docs-site/sidebars.ts` — 
- `docs-site/docs/index.md` — 
- `docs-site/docs/getting-started/installation.md` — 
- `docs-site/docs/getting-started/quickstart.md` — 
- `docs-site/docs/getting-started/first-trace.md` — 
- `docs-site/docs/sdk/typescript.md` — 
- `docs-site/docs/sdk/python.md` — 
- `docs-site/docs/integrations/langgraph.md` — 
- `docs-site/docs/integrations/crewai.md` — 
- `docs-site/docs/integrations/mastra.md` — 
- `docs-site/docs/integrations/pydantic-ai.md` — 
- `docs-site/docs/integrations/bedrock-agentcore.md` — 
- `docs-site/docs/integrations/google-adk.md` — 
- `docs-site/docs/integrations/opentelemetry-bridge.md` — 
- `docs-site/docs/mcp-server/setup.md` — 
- `docs-site/docs/mcp-server/tool-reference.md` — 
- `docs-site/docs/ci-cd/quality-gate-action.md` — 
- `docs-site/docs/evaluation-cookbook/index.md` — 
- `docs-site/docs/evaluation-cookbook/manual-scoring.md` — 
- `docs-site/docs/evaluation-cookbook/llm-as-a-judge.md` — 
- `docs-site/docs/evaluation-cookbook/dataset-curation.md` — 
- `docs-site/docs/evaluation-cookbook/ci-quality-gates.md` — 
- `.github/workflows/docs.yml` — 
- `pnpm-workspace.yaml` — 
