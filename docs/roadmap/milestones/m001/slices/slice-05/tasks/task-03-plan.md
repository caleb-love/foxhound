---
estimated_steps: 30
estimated_files: 7
skills_used: []
---

# T03: Write evaluation cookbook and add GitHub Pages deploy workflow

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

## Inputs

- `docs-site/package.json`
- `docs-site/docusaurus.config.ts`
- `docs-site/sidebars.ts`
- `docs-site/docs/mcp-server/tools.md`
- `docs-site/docs/ci-cd/quality-gate.md`

## Expected Output

- `docs-site/docs/evaluation-cookbook/index.md`
- `docs-site/docs/evaluation-cookbook/manual-scoring.md`
- `docs-site/docs/evaluation-cookbook/llm-as-judge.md`
- `docs-site/docs/evaluation-cookbook/dataset-curation.md`
- `docs-site/docs/evaluation-cookbook/ci-quality-gates.md`
- `docs-site/sidebars.ts`
- `.github/workflows/docs.yml`

## Verification

pnpm --filter @foxhound-ai/docs build && find docs-site/docs/evaluation-cookbook -name '*.md' | wc -l | grep -q '[5-9]' && test -f .github/workflows/docs.yml
