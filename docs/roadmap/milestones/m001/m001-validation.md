---
verdict: needs-attention
remediation_round: 0
reviewers: 3
---

# Milestone Validation: M001 — Phase 5: Developer Experience & Distribution

## Reviewer A — Requirements Coverage

| Requirement | Status | Evidence |
|------------|--------|---------|
| **R007** — Manual scores attachable to any trace/span from IDE via `foxhound_score_trace` and `foxhound_get_trace_scores` | ✅ COVERED | Implemented in S01 with preview/confirm pattern; supports numeric + categorical scores; span-level and trace-level; 15 unit tests; validated in REQUIREMENTS.md |
| **R008** — LLM-as-a-Judge evaluators accessible from IDE via `foxhound_list_evaluators`, `foxhound_run_evaluator`, `foxhound_get_evaluator_run` | ✅ COVERED | Implemented in S01 with async status polling; contextual emoji status formatting; Zod validation on input ranges; 14 unit tests; validated in REQUIREMENTS.md |
| **R010** — Datasets auto-curable from production traces via `foxhound_add_trace_to_dataset` and `foxhound_curate_dataset` | ✅ COVERED | Implemented in S01; bulk curation via score thresholds; sourceTraceId lineage preserved; preview/confirm for single add; 13 unit tests; validated in REQUIREMENTS.md |

**Implied deliverables with gaps (not formally registered requirements):**

| Deliverable | Status | Evidence |
|------------|--------|---------|
| S01 — 10 MCP tools callable from IDE | ✅ COVERED | 60 unit tests pass; all tools registered; TypeScript strict compilation passes |
| S02 — MCP server discoverable in registries | ⚠️ PARTIAL | All artifacts ready; npm publish and MCP Registry OAuth blocked by auth requirements; registry not discoverable |
| S03 — GitHub Action runs evaluators, fails PR, posts comment | ✅ COVERED | 25KB bundle; 13/14 UAT checks pass; E2E needs live runner |
| S04 — Pydantic AI, Mastra, Bedrock AgentCore, Google ADK instrumented | ✅ COVERED | 248 tests pass (163 Python + 85 TS); all 4 frameworks verified |
| S05 — docs.foxhound.dev live with guides and reference | ⚠️ PARTIAL | 21-page site builds; GitHub Pages workflow deployed; DNS CNAME for docs.foxhound.dev not configured |

**Verdict: NEEDS-ATTENTION** — All 3 formal requirements are validated and covered, but two slice goals are only partially met: MCP Registry publication blocked on human authentication steps, and docs.foxhound.dev DNS CNAME pending.

---

## Reviewer B — Cross-Slice Integration

| Boundary | Producer Claim | Consumer Claim | Status |
|----------|---------------|----------------|--------|
| **S01 → S03**: FoxhoundApiClient with `createExperiment`, `getExperiment`, `compareExperiments` | S01 `provides` lists 10 MCP tools only — does NOT claim these API client methods | S03 `requires` explicitly names these methods from S01; bundle verified via grep | ⚠️ CONTRACT GAP — pre-existing API client attributed to S01; functional integration works |
| **S01 → S04**: `Tracer`/`ActiveSpan` types + `FoxhoundClient` API | S01 `provides` lists 10 MCP tools only — does NOT claim SDK types | S04 `requires` explicitly claims these from S01; 248 tests pass confirming bridge works | ⚠️ CONTRACT GAP — same root cause; lineage metadata inaccurate but integration functional |
| **S02 → S03**: MCP server design patterns | S02 established preview/confirm and registry patterns | S03 applied similar patterns; independently derived | ✅ PASS (soft/informational) |
| **S02 → S05**: `mcp-server/README.md` registry installation content | S02 produced installation documentation and README | S05 explicitly lists `packages/mcp-server/README.md` as upstream surface consumed | ✅ PASS |
| **S03 → S05**: quality gate patterns + `quality-gate-example.yml` | S03 produced composite action, example workflow, documentation | S05 explicitly consumed S03 quality gate summary for GitHub Action integration docs | ✅ PASS |
| **S04 → S05**: Updated SDK READMEs with OTel bridge content | S04 updated `sdk-py/README.md` and `sdk/README.md` with bridge sections | S05 consumed both SDK READMEs; 7 integration pages including OTel bridge delivered | ✅ PASS |

**Note on contract gaps:** Both flagged boundaries are documentation/attribution issues rather than functional failures. The `createExperiment`/`getExperiment`/`compareExperiments` methods and SDK types are pre-M001 infrastructure. S01 added MCP tool wrappers over the existing client; it did not create those methods. S03 and S04 attributed these pre-existing dependencies to S01 in their `requires` fields. The roadmap lists all slices with `depends: —`, confirming these relationships were not formally encoded. All functional integrations work correctly.

**Verdict: NEEDS-ATTENTION** — Two boundaries (S01→S03, S01→S04) have producer/consumer mismatches in contract metadata fields: consumers claim to depend on S01 for artifacts S01 never produced. All four remaining boundaries are honored. Functional integrations verified.

---

## Reviewer C — Assessment & Acceptance Criteria

| | Criterion | Evidence |
|---|---|---|
| [x] | **S01: MCP tools explain failures, suggest fixes, score traces, run evaluators, add traces to datasets from IDE** | 10 tools implemented in `packages/mcp-server/src/index.ts`. 60 unit tests pass covering all tools, error states, and edge cases. UAT documents all 11 test cases with expected behaviors. |
| [ ] | **S02: Foxhound MCP server discoverable in Claude Code, VS Code, and JetBrains MCP registries** | All artifacts ready (`LICENSE`, `server.json`, `mcpName`, `PUBLISH.md`, v0.2.0 build). **Gap:** npm publish and MCP Registry OAuth not completed. S02-SUMMARY explicitly states "demo criteria is not met." TC5–TC8 in S02-UAT are BLOCKED/PENDING. Registry search returns empty. |
| [x] | **S03: GitHub Action runs evaluators against dataset, fails PR if scores drop, posts comparison comment** | 25KB self-contained bundle. S03-ASSESSMENT: 13/14 checks PASS. One check (`E2E real PR testing`) marked NEEDS-HUMAN — requires live GitHub runner. All automatable checks pass. |
| [x] | **S04: Pydantic AI, Mastra, Amazon Bedrock AgentCore, Google ADK instrumented with one decorator/function call** | Files verified in worktree. S04-UAT: 25/25 test cases pass, 248/248 tests green. S04-ASSESSMENT FAIL is a false alarm (wrong directory). |
| [ ] | **S05: docs.foxhound.dev live with getting started guides, API reference, SDK reference, evaluation cookbook** | Build exits 0, 21 pages created, 12/12 UAT cases pass, GitHub Pages workflow correctly configured. **Gap:** DNS CNAME for `docs.foxhound.dev` not configured — S05-SUMMARY notes this as a known limitation. |

**Verdict: NEEDS-ATTENTION** — 3/5 criteria fully met. Two gaps: S02 requires human npm authentication + MCP Registry OAuth; S05 requires DNS CNAME setup. Both are documented manual steps, not implementation defects. S04 assessment FAIL is a false alarm (wrong directory check).

---

## Synthesis

All three formally tracked requirements (R007, R008, R010) are fully covered with unit test and UAT evidence across S01. Three of five slice goals (S01, S03, S04) are fully delivered and verified with comprehensive test coverage. Two slice goals are partially met due to external operational blockers — S02 registry publication is blocked by npm/OAuth authentication requirements that cannot be automated, and S05's custom domain is blocked by a DNS CNAME configuration that requires manual action; neither gap represents an implementation defect. Two cross-slice contract metadata mismatches exist where pre-existing API client methods were attributed to S01 in consumer `requires` fields, but all functional integrations are verified working.

## Remediation Plan

No code remediation required. The following manual human actions are needed to fully satisfy the two partial slice goals:

**S02 — MCP Registry Publication:**
1. Run `npm login` (or set `NPM_TOKEN` env var) then `npm publish` in `packages/mcp-server/` to publish `@foxhound-ai/mcp-server@0.2.0`
2. Run `./mcp-publisher login github` (complete OAuth in browser within 120s) then `./mcp-publisher publish` to register `io.github.caleb-love/foxhound` in the MCP Registry
3. Verify with `npm view @foxhound-ai/mcp-server version` and registry API search
4. Refer to `packages/mcp-server/PUBLISH.md` for complete step-by-step guide

**S05 — docs.foxhound.dev DNS:**
1. Add a CNAME DNS record pointing `docs.foxhound.dev` → `<github-pages-url>` at the domain registrar
2. Configure the custom domain in GitHub Pages settings for the repository
3. Verify with `curl -I https://docs.foxhound.dev`

**S03 — Live E2E (Optional):**
- Perform a real GitHub Actions E2E run with live Foxhound API access and actual PR creation to validate end-to-end flow (all automatable checks already pass)
