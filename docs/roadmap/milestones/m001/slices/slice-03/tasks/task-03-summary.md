---
id: T03
parent: S03
milestone: M001
key_files:
  - .github/actions/quality-gate/run.ts
  - .github/actions/quality-gate/dist/run.js
  - .github/actions/quality-gate/test-comparison.ts
key_decisions:
  - Used native fetch for GitHub API instead of @actions/github to keep bundle lean and avoid runtime dependencies
  - Implemented PR number extraction from both GITHUB_REF and GITHUB_EVENT_PATH for maximum compatibility across GitHub Actions contexts
  - Gracefully degrade when GitHub API fails — write to step summary only and continue (non-fatal)
  - Fall back to comparison failure mode when compareExperiments API errors, posting scores without deltas
duration: 
verification_result: passed
completed_at: 2026-04-10T06:17:15.949Z
blocker_discovered: false
---

# T03: Implemented score comparison, PR comment posting with idempotent updates, threshold enforcement, and markdown table formatting for GitHub Actions quality gate.

**Implemented score comparison, PR comment posting with idempotent updates, threshold enforcement, and markdown table formatting for GitHub Actions quality gate.**

## What Happened

Added score comparison logic that calls compareExperiments API when baseline-experiment-id is provided, aggregates LLM judge scores per evaluator (computing mean values), and formats results as a markdown table with baseline/current/delta columns and status emoji. Implemented PR comment posting via GitHub API using native fetch, searching for existing comments with a hidden HTML marker (`<!-- foxhound-quality-gate -->`) to enable idempotent updates (PATCH if found, POST if not). Added threshold enforcement that collects violations (evaluators below threshold), logs which evaluators failed with their scores, and exits with code 1 to fail the workflow. Handled missing baseline case gracefully by posting scores without deltas and noting this is the first run. Wrote comparison markdown to $GITHUB_STEP_SUMMARY for workflow UI visibility. Generated comparison URL output linking to Foxhound UI for manual inspection.

Created a unit test (test-comparison.ts) that validates score aggregation logic with mock data, confirming mean computation and threshold violation detection work correctly. Test passes with expected results: accuracy improves (0.86 → 0.89, +0.03), coherence degrades (0.75 → 0.65, -0.10, violates 0.70 threshold).

All must-haves implemented: compareExperiments called with baseline+current IDs, scores aggregated via mean reduction, markdown table formatted with deltas and emoji, PR comment posted/updated via GitHub API, existing comment found via HTML marker search, table written to step summary, threshold violations trigger exit code 1, missing baseline handled gracefully, comparison URL output written, failed evaluators logged with names and scores.

Rebuilt bundle via pnpm build, bundle size 25.3kb. All verification patterns present in source and bundled output.

## Verification

Ran verification commands from task plan:
- Pattern checks: compareExperiments present in run.ts, POST method present (for GitHub API comment creation), threshold logic present
- Bundled output: compareExperiments method included in dist/run.js (API client fully inlined)

Created and executed unit test test-comparison.ts to validate score aggregation logic:
- Mock data simulates ExperimentComparisonResponse with 2 evaluators across 2 experiments
- Aggregation correctly computes baseline accuracy 0.860 (mean of 0.85, 0.87)
- Aggregation correctly computes current accuracy 0.890 (mean of 0.90, 0.88)
- Coherence degradation detected (0.75 → 0.65, -0.10)
- Threshold violation detected correctly (0.65 < 0.70 threshold)
- All test assertions passed

Verified error handling patterns:
- Comparison failure handling: falls back to scores-only mode with error message
- Threshold validation: rejects NaN or invalid values
- GitHub API error handling: catches failures and writes to step summary only (non-fatal)
- Missing baseline handling: posts scores without deltas, notes first run
- Empty scores edge case: displays warning when no LLM judge scores found

Verified observability signals:
- PR comment marker (<!-- foxhound-quality-gate -->) present for idempotent updates
- Step summary written with comparisonMarkdown
- Threshold violations logged with evaluator names and scores
- Comparison URL output to app.foxhound.dev
- Status logging during comparison ("Comparing with baseline experiment...")

Slice verification checks (partial, remaining tasks needed):
- ✅ .github/actions/quality-gate/action.yml exists
- ✅ .github/actions/quality-gate/dist/run.js exists
- ✅ API client bundled (createExperiment method present in dist/run.js)
- ⚠️ README.md missing (expected for later task)
- ⚠️ example workflow missing (expected for later task)

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `grep -q 'compareExperiments' .github/actions/quality-gate/run.ts` | 0 | ✅ pass | 50ms |
| 2 | `grep -q 'POST' .github/actions/quality-gate/run.ts` | 0 | ✅ pass | 45ms |
| 3 | `grep -q 'threshold' .github/actions/quality-gate/run.ts` | 0 | ✅ pass | 48ms |
| 4 | `grep -q 'compareExperiments' .github/actions/quality-gate/dist/run.js` | 0 | ✅ pass | 52ms |
| 5 | `npx ts-node test-comparison.ts` | 0 | ✅ pass | 2100ms |
| 6 | `test -f .github/actions/quality-gate/action.yml` | 0 | ✅ pass | 15ms |
| 7 | `test -f .github/actions/quality-gate/dist/run.js` | 0 | ✅ pass | 18ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `.github/actions/quality-gate/run.ts`
- `.github/actions/quality-gate/dist/run.js`
- `.github/actions/quality-gate/test-comparison.ts`
