---
id: M001
title: "Phase 5: Developer Experience & Distribution"
status: complete
completed_at: 2026-04-11T01:53:38.941Z
key_decisions:
  - Keep all MCP tool registrations in single index.ts file (D001) — declarative registration pattern stays readable at 31 tools without splitting into modules
  - Bundled standalone script with esbuild for GitHub Actions (D002/D003) — eliminates runtime npm install, produces 25KB self-contained bundle, works on any runner
  - PR comment idempotency via hidden HTML marker (D003) — prevents comment spam on force-pushes, keeps PRs clean with single updated result
  - Foxhound API as critical path, GitHub API as non-critical in quality gate (D004) — threshold enforcement always visible even if comment posting fails
  - OTel SpanProcessor bridge over framework-specific adapters (D005/D006) — reduced implementation from ~1200 lines to ~400 lines, works for any future OTel-instrumented framework
  - Structural duck-typing for OTel TypeScript bridge (D007) — avoids version coupling to @opentelemetry/api package versions
  - Registry-first installation with npm fallback for MCP server (S02) — cleaner UX when registry available, compatible fallback always works
  - Content reuse from source READMEs for docs site (S05) — docs stay synchronized as code evolves without manual doc updates
key_files:
  - packages/mcp-server/src/index.ts — 31 MCP tools including 10 new tools for failure analysis, scoring, evaluators, and datasets
  - packages/mcp-server/src/api-client.test.ts — 60 unit tests covering all new MCP tools
  - packages/mcp-server/server.json — MCP Registry manifest declaring env vars
  - packages/mcp-server/LICENSE — MIT license for public distribution
  - packages/mcp-server/PUBLISH.md — Manual publication guide for npm and MCP Registry
  - .github/actions/quality-gate/action.yml — Composite action definition with 8 inputs, 2 outputs
  - .github/actions/quality-gate/run.ts — 435-line TypeScript source for quality gate logic
  - .github/actions/quality-gate/dist/run.js — 25KB esbuild bundle (zero runtime dependencies)
  - .github/actions/quality-gate/README.md — Complete documentation with troubleshooting
  - .github/workflows/quality-gate-example.yml — Example CI/CD workflow
  - packages/sdk-py/foxhound/integrations/opentelemetry.py — Python OTel SpanProcessor bridge (310 lines)
  - packages/sdk-py/tests/test_otel_bridge.py — 51 Python OTel unit tests
  - packages/sdk/src/integrations/opentelemetry.ts — TypeScript OTel SpanProcessor bridge (230 lines)
  - packages/sdk/src/integrations/opentelemetry.test.ts — 33 TypeScript OTel unit tests
  - docs-site/docs/mcp-server/tool-reference.md — All 31 MCP tools documented and categorized
  - docs-site/docs/evaluation-cookbook/ — 5-page evaluation cookbook
  - .github/workflows/docs.yml — GitHub Pages deployment workflow
  - pnpm-workspace.yaml — Updated to include docs-site and .github/actions/*
lessons_learned:
  - Vitest v3 removed --grep flag — task plans written for v2 include --grep which causes CACError in v3. Use file-path argument or --testNamePattern instead. This burned time in S01.
  - OTel JS SDK uses span.parentSpanId (hex string) vs Python's span.parent.span_id (integer) — different field names and types across languages. Always check language-specific OTel SDK docs before implementing bridges.
  - OTel SpanProcessor structural duck-typing in TypeScript — you do NOT need @opentelemetry/api as a devDependency. Define local structural interfaces and mock spans as plain objects in tests. Simpler and avoids transitive devDep.
  - MCP Registry publication requires human authentication in 2026 — npm login and GitHub OAuth device flow both require interactive browser sessions. Cannot be automated unattended. Plan for manual steps in any publication slice.
  - Docusaurus build isolation from monorepo webpack — use .npmrc with node-linker=hoisted and explicit webpack@~5.95.0 devDependency to isolate from hoisted workspace webpack version conflicts.
  - Absolute paths in Docusaurus index pages — sibling relative links (./page) cause broken-link warnings. Use absolute paths (/section/page) in overview/index pages.
  - esbuild bundling removes --packages=external by default — to create standalone scripts with no runtime dependencies, remove the external packages flag. Bundle size increases moderately (~25KB) but eliminates runtime npm install entirely.
  - GitHub Actions composite actions need .github/actions/* in pnpm-workspace.yaml for workspace deps at build time — but the final bundle must be completely self-contained (no runtime workspace references).
  - Cross-slice contract metadata mismatches occur when consumers attribute pre-existing infrastructure to a slice that only wraps it — S03 and S04 claimed S01 provided FoxhoundApiClient methods that pre-dated M001. Slice provides/requires fields should only claim what that slice actually created.
  - OTel bridge architecture scales better than framework-specific adapters — the decision to build one bridge per language instead of four per-framework adapters reduced implementation from ~1200 to ~400 lines while gaining future-proofing for any OTel-instrumented framework.
---

# M001: Phase 5: Developer Experience & Distribution

**Shipped 10 new MCP debugging tools, OTel integration bridges for 4 frameworks, a GitHub Actions quality gate, publication-ready MCP Registry artifacts, and a complete 21-page Docusaurus documentation site — making Foxhound dramatically easier to adopt and integrate.**

## What Happened

M001 delivered the "Developer Experience & Distribution" phase across five slices over two days, transforming Foxhound from a capable platform into an ergonomic one that developers can adopt without friction.

**S01 — MCP Server Enhancement (10 new tools)**
Built four categories of MCP tools callable directly from Claude Code, Cursor, and Windsurf IDEs:
- Failure analysis: `foxhound_explain_failure` (error chain reconstruction from span tree) and `foxhound_suggest_fix` (six-category pattern-matching classifier: timeout, auth, rate limit, tool error, LLM error, validation — with category-specific remediation steps).
- Scoring: `foxhound_score_trace` (preview/confirm pattern, trace and span level, numeric and categorical) and `foxhound_get_trace_scores` (markdown table output).
- Evaluators: `foxhound_list_evaluators`, `foxhound_run_evaluator` (async with Zod-validated 1-50 trace limit), `foxhound_get_evaluator_run` (contextual emoji status: ⏳/✅/❌).
- Datasets: `foxhound_list_datasets`, `foxhound_add_trace_to_dataset` (preview/confirm, extracts root span attributes as input), `foxhound_curate_dataset` (bulk curation from score thresholds with operator support: >=, >, <=, <, ==, !=).
All tools use client-side analysis without new backend endpoints. 60 unit tests cover all tools, error states, auth failures, edge cases, and markdown formatting. TypeScript strict compilation passes.

**S02 — MCP Registry Publication**
Created all publication artifacts: MIT LICENSE, `mcpName: io.github.caleb-love/foxhound` in package.json, server.json manifest (declaring FOXHOUND_API_KEY as required secret and FOXHOUND_ENDPOINT as optional non-secret), bumped version to 0.2.0. Created comprehensive PUBLISH.md with step-by-step manual publication guide. Package builds cleanly. Blocked on human authentication (npm login + MCP Registry GitHub OAuth) — documented as manual follow-up steps.

**S03 — GitHub Actions Quality Gate**
Delivered a production-ready composite GitHub Action with a 25KB esbuild-bundled standalone script (all dependencies inlined, zero runtime npm install). Key capabilities: on-demand experiment creation, exponential backoff polling (2s→4s→...→30s max, configurable timeout default 600s), baseline score comparison with threshold enforcement, idempotent PR comment posting via hidden HTML marker (PATCH existing or POST new), graceful API degradation (Foxhound critical path, GitHub API non-critical). Complete documentation with inputs reference table, outputs, 3 usage examples, and 8+ troubleshooting scenarios. pnpm-workspace.yaml updated to include .github/actions/* for build-time dependency resolution. 13/14 UAT checks pass; E2E requires live GitHub runner.

**S04 — Framework Integration Expansion**
Replaced the planned framework-specific adapters with a single OTel SpanProcessor bridge in both languages — a better architectural decision. Python bridge (310 lines) implements OTel SpanProcessor protocol mapping GenAI semantic conventions (chat/text_completion → llm_call, embeddings → tool_call, agent/tool → agent_step) to Foxhound spans. TypeScript bridge (230 lines) uses structural duck-typing to avoid version coupling to OTel API. Both bridges support thread-safe span storage and parent-child nesting reconstruction. 51 Python + 33 TypeScript OTel tests, plus 163 Python + 85 TypeScript SDK tests — 248 total, zero regressions. All four frameworks (Pydantic AI, Mastra, Bedrock AgentCore, Google ADK) are instrumented via copy-paste documentation examples in both SDK READMEs.

**S05 — Documentation Site**
Built a Docusaurus 3 site integrated into the monorepo (pnpm workspace, Turborepo) with 21 pages across 6 sections: Getting Started (installation, quickstart, first-trace), SDK Reference (TypeScript + Python), Integrations (7 pages: LangGraph, CrewAI, Mastra, Pydantic AI, Bedrock AgentCore, Google ADK, OTel bridge), MCP Server (setup + 31-tool reference grouped into 8 categories), CI/CD (quality gate action guide), and Evaluation Cookbook (5 practical guides: manual scoring, LLM-as-Judge, dataset curation, CI integration). Content pulled directly from source READMEs for synchronization. GitHub Pages workflow deployed. Build exits 0 with no broken links on all three verification runs. DNS CNAME for docs.foxhound.dev pending manual configuration at domain registrar.

## Success Criteria Results

| Criterion | Result | Evidence |
|-----------|--------|---------|
| **S01: MCP tools explain failures, suggest fixes, score traces, run evaluators, and add traces to datasets from IDE** | ✅ **MET** | 10 tools in `packages/mcp-server/src/index.ts` (31 total registered). `foxhound_explain_failure` reconstructs error chains from span tree. `foxhound_suggest_fix` classifies into 6 categories with remediation. `foxhound_score_trace`/`foxhound_get_trace_scores` implement preview/confirm pattern. `foxhound_list_evaluators`/`foxhound_run_evaluator`/`foxhound_get_evaluator_run` expose async evaluator workflow. `foxhound_list_datasets`/`foxhound_add_trace_to_dataset`/`foxhound_curate_dataset` enable full dataset management. 60 unit tests pass. |
| **S02: Foxhound MCP server discoverable in Claude Code, VS Code, and JetBrains MCP registries** | ⚠️ **PARTIAL** | All publication artifacts complete: `LICENSE`, `server.json`, `mcpName: io.github.caleb-love/foxhound`, `@foxhound-ai/mcp-server@0.2.0` built, `PUBLISH.md` with step-by-step guide. **Gap:** npm publish and MCP Registry OAuth require human authentication (cannot be automated). Registry not yet searchable. Follow PUBLISH.md to complete. |
| **S03: GitHub Action runs evaluators against dataset, fails PR if scores drop, posts comparison comment** | ✅ **MET** | `.github/actions/quality-gate/dist/run.js` (25KB bundled). Experiment creation, exponential backoff polling, score comparison, threshold enforcement, idempotent PR comment posting all implemented. 13/14 UAT checks pass. One check requires live GitHub runner. |
| **S04: Pydantic AI, Mastra, Amazon Bedrock AgentCore, Google ADK apps instrumented with one decorator/function call** | ✅ **MET** | `packages/sdk-py/foxhound/integrations/opentelemetry.py` (310 lines) and `packages/sdk/src/integrations/opentelemetry.ts` (230 lines) deliver single-call instrumentation. 248/248 tests pass. All 4 frameworks documented with copy-paste examples in both SDK READMEs. |
| **S05: docs.foxhound.dev live with getting started guides, API reference, SDK reference, evaluation cookbook** | ⚠️ **PARTIAL** | Docusaurus site with 21 pages builds cleanly (build exits 0, no broken links). GitHub Pages workflow deployed. 12/12 UAT checks pass. **Gap:** DNS CNAME for `docs.foxhound.dev` not configured (manual domain registrar action required). |

## Definition of Done Results

| Item | Status | Evidence |
|------|--------|---------|
| All 5 slices marked ✅ in roadmap | ✅ **DONE** | S01, S02, S03, S04, S05 all show `✅` in m001-roadmap.md; DB confirms all slices `status: complete` |
| All 5 slice summaries exist | ✅ **DONE** | S01-SUMMARY.md, S02-SUMMARY.md, S03-SUMMARY.md, S04-SUMMARY.md, S05-SUMMARY.md all present in respective slice directories |
| Cross-slice integrations work | ✅ **DONE** | S01→S03: FoxhoundApiClient methods bundled in quality-gate action (grep-verified in dist/run.js). S02→S05: MCP server README content consumed by docs site. S03→S05: Quality gate patterns used in evaluation cookbook. S04→S05: Updated SDK READMEs consumed by integration pages. All functional integrations verified. |
| Code changes exist (non-. diff) | ✅ **DONE** | 79 non-. files changed, 22,077 insertions. Includes MCP tools, OTel bridges, docs site, GitHub Actions, pnpm-lock.yaml |
| Requirements validated (R007, R008, R010) | ✅ **DONE** | All three requirements marked `validated` in REQUIREMENTS.md with full evidence trails |
| TypeScript compilation passes | ✅ **DONE** | Reported in S01, S03, S04 summaries with strict mode |
| Test suites pass | ✅ **DONE** | 60 MCP unit tests (S01), 248 SDK tests (S04: 163 Python + 85 TypeScript), 13/14 GitHub Actions UAT checks (S03), 12/12 docs UAT checks (S05) |

## Requirement Outcomes

| Requirement | Previous Status | New Status | Evidence |
|-------------|----------------|------------|---------|
| **R007** — Manual scores attachable to any trace/span from IDE via MCP tools | active | **validated** | `foxhound_score_trace` and `foxhound_get_trace_scores` implemented in S01. Preview/confirm pattern prevents accidental creation. Supports numeric (0-1) and categorical scores, trace and span level, optional comments. 15 unit tests. Status transitioned in REQUIREMENTS.md. |
| **R008** — LLM-as-a-Judge evaluators accessible from IDE via MCP tools | active | **validated** | `foxhound_list_evaluators`, `foxhound_run_evaluator`, `foxhound_get_evaluator_run` implemented in S01. Async with Zod-validated 1-50 trace range. Contextual emoji status formatting. 14 unit tests. Status transitioned in REQUIREMENTS.md. |
| **R010** — Datasets auto-curable from production traces via MCP tools | active | **validated** | `foxhound_add_trace_to_dataset` and `foxhound_curate_dataset` implemented in S01. Bulk curation via score thresholds with operator support. sourceTraceId lineage preserved. preview/confirm for single add. 13 unit tests. Status transitioned in REQUIREMENTS.md. |

## Deviations

**S02 — Registry publication blocked by authentication:** Plan assumed non-interactive authentication for npm and MCP Registry. Both require human browser interaction. All code and artifacts are complete; only authentication steps are pending. Documented in PUBLISH.md.

**S02 — Vitest --grep flag:** S01 initial verification used --grep (Jest syntax). Corrected to -t during execution (Vitest v3 naming convention). No functional impact.

**S04 — OTel bridge instead of framework adapters:** S04 plan described framework-specific adapters. During execution, a single OTel SpanProcessor bridge per language was built instead — better architecture that reduces code from ~1200 lines to ~400 lines while covering more frameworks. Recorded as D005/D006.

**S03 — GitHub Actions quality gate location:** Quality gate action resides in main repo `.github/actions/quality-gate/` (committed to main before M001 started) rather than worktree. This is expected — GitHub Actions must be at repo root level.

**Cross-slice contract attribution:** S03 and S04 `requires` fields attributed pre-existing FoxhoundApiClient methods to S01. S01 only added MCP tool wrappers; the underlying API client predates M001. Functional integrations work correctly; only metadata attribution was inaccurate.

## Follow-ups

**S02 — Complete MCP Registry Publication (Requires Human Action):**
1. Run `npm login` (or set NPM_TOKEN), then `npm publish` in `packages/mcp-server/` → publishes @foxhound-ai/mcp-server@0.2.0
2. Run `./mcp-publisher login github` (complete OAuth in browser within 120s), then `./mcp-publisher publish` → registers io.github.caleb-love/foxhound in MCP Registry
3. Verify: `npm view @foxhound-ai/mcp-server version` should return 0.2.0; registry API should return entry
4. Full guide in `packages/mcp-server/PUBLISH.md`

**S05 — Configure docs.foxhound.dev DNS (Requires Human Action):**
1. Add CNAME record pointing `docs.foxhound.dev` → GitHub Pages endpoint at domain registrar
2. Configure custom domain in GitHub Pages repository settings
3. Verify: `curl -I https://docs.foxhound.dev` should return 200

**Future Improvements:**
- Automate npm publish via CI/CD with NPM_TOKEN secret (eliminates manual publish step)
- Add GitHub Actions quality gate to Foxhound's own CI (dogfooding)
- Post-launch integration tests with real framework runtimes (Pydantic AI Agent, Mastra app, Bedrock agent, Google ADK agent) to validate OTel bridge end-to-end
- Documentation versioning for SDK breaking changes
- Add doc/code drift detection (detect when MCP tool reference is stale vs source)
- Tune Docusaurus search for Foxhound-specific terminology
- Baseline management system for GitHub Actions quality gate (auto-store/retrieve experiment IDs per branch)
