---
estimated_steps: 7
estimated_files: 2
skills_used: []
---

# T03: Add score comparison and PR comment posting

**Slice:** S03 — GitHub Actions Quality Gate
**Milestone:** M001

## Description

Call compareExperiments API when baseline-experiment-id is provided. Format score deltas as markdown table (evaluator name | baseline score | current score | delta | status emoji). Post comment to PR via GitHub API using GITHUB_TOKEN and context (issue number from github.rest.issues.createComment). Update existing comment if found (search for hidden HTML marker). Handle missing baseline case (first run) by posting scores without deltas. Compute threshold violations and exit with code 1 if any evaluator drops below threshold. Write comparison URL to step summary.

This task delivers the core user-facing value: developers see score changes directly on their PRs and the workflow blocks merges if quality degrades.

## Failure Modes

| Dependency | On error | On timeout | On malformed response |
|------------|----------|-----------|----------------------|
| Foxhound API (compareExperiments) | Log error, skip comparison, post scores only | N/A (single request) | Parse error, log, skip comparison |
| GitHub API (issues.createComment) | Log error, write to step summary only, continue (non-fatal) | Retry with backoff, fail after 3 attempts | Log error, continue |
| GitHub API (issues.listComments + updateComment) | Fall back to createComment | Retry, timeout after 10s | Fall back to createComment |

## Load Profile

- **Shared resources**: Foxhound API server, GitHub API (rate limit 5000 req/hour for GITHUB_TOKEN)
- **Per-operation cost**: 1 GET (compareExperiments), 1-3 GitHub API calls (listComments, updateComment or createComment)
- **10x breakpoint**: GitHub API rate limit (unlikely — 5000/hr >> typical PR volume)

## Negative Tests

- **Malformed inputs**: baseline-experiment-id doesn't exist (API returns 404), threshold not a number (parse error), no scores in comparison response (edge case: all evaluators disabled)
- **Error paths**: GitHub API 403 (insufficient permissions, missing pull-requests: write), GitHub API 404 (PR already closed), network timeout on comment post
- **Boundary conditions**: Exactly at threshold (should pass), 0.0001 below threshold (should fail), no baseline provided (first run, no deltas), baseline and current are identical (delta 0)

## Steps

1. Parse additional inputs:
   - INPUT_BASELINE_EXPERIMENT_ID (optional)
   - INPUT_THRESHOLD (default "0.0", parse as float)
   - GITHUB_TOKEN (from env, required for comment posting)
   - github.context.issue.number (from @actions/github or parse GITHUB_CONTEXT env var)
2. If baseline-experiment-id is provided:
   - Call compareExperiments([baseline-experiment-id, current-experiment-id])
   - Parse ExperimentComparisonResponse (experiments, runs, items, scores arrays)
   - Group scores by evaluator name (scores array has {name, value, label, ...} per run)
   - Compute aggregate score per evaluator per experiment (mean of values where source="llm_judge")
   - Calculate delta: currentScore - baselineScore
3. Format markdown table:
   - With baseline: `| Evaluator | Baseline | Current | Delta | Status |` with rows showing scores, delta (+0.05 or -0.03), and emoji (✅ improved, ⚠️ degraded but above threshold, ❌ below threshold)
   - Without baseline: `| Evaluator | Score |` with rows showing just current scores
   - Add hidden HTML marker at top: `<!-- foxhound-quality-gate -->`
4. Post or update PR comment:
   - Fetch existing comments via GitHub API: `GET /repos/{owner}/{repo}/issues/{number}/comments`
   - Search for comment containing `<!-- foxhound-quality-gate -->`
   - If found, update comment: `PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}`
   - If not found, create comment: `POST /repos/{owner}/{repo}/issues/{number}/comments`
   - Use GITHUB_TOKEN for auth (Bearer token)
5. Write comparison table to $GITHUB_STEP_SUMMARY (markdown file that appears in workflow summary)
6. Compute threshold violations:
   - For each evaluator, check if currentScore < threshold
   - Collect violators in array: `[{name, score, threshold}]`
   - If violations exist, log error: "Quality gate failed: {count} evaluator(s) below threshold {threshold}: {names}"
   - Exit with code 1
7. Write comparison-url output: `comparison-url=https://app.foxhound.dev/experiments/compare?ids={baseline},{current}`
8. Rebuild bundle: `pnpm build`

## Must-Haves

- [ ] Calls compareExperiments when baseline provided
- [ ] Computes score aggregates per evaluator (mean of values)
- [ ] Formats markdown table with deltas and status emoji
- [ ] Posts PR comment via GitHub API (creates new or updates existing)
- [ ] Searches for existing comment using hidden HTML marker
- [ ] Writes table to $GITHUB_STEP_SUMMARY
- [ ] Enforces threshold: exits with code 1 if any score below threshold
- [ ] Handles missing baseline gracefully (posts scores without deltas)
- [ ] Writes comparison-url output
- [ ] Logs which evaluators failed threshold check

## Verification

```bash
grep -q 'compareExperiments' .github/actions/quality-gate/run.ts && \
grep -q 'github.issues.createComment' .github/actions/quality-gate/run.ts && \
grep -q 'threshold' .github/actions/quality-gate/run.ts
```

Alternative if @actions/github is not used:
```bash
grep -q 'compareExperiments' .github/actions/quality-gate/run.ts && \
grep -q 'POST.*issues.*comments' .github/actions/quality-gate/run.ts && \
grep -q 'threshold' .github/actions/quality-gate/run.ts
```

## Observability Impact

- Signals added: PR comment with score table (persistent, visible to developers), step summary with score table (visible in workflow UI), threshold violation logs (which evaluators failed, by how much)
- How a future agent inspects this: Check PR comments for foxhound-quality-gate marker, read $GITHUB_STEP_SUMMARY file, check workflow logs for "Quality gate failed" errors
- Failure state exposed: Threshold violations logged with evaluator names and scores, GitHub API errors logged with status codes, comparison URL in output for manual inspection

## Inputs

- `.github/actions/quality-gate/run.ts` — Polling logic from T02
- `packages/api-client/src/index.ts` — compareExperiments method
- `packages/api-client/src/types.ts` — ExperimentComparisonResponse type
- `packages/types/src/index.ts` — Score type

## Expected Output

- `.github/actions/quality-gate/run.ts` — Full score comparison, markdown formatting, PR comment posting, threshold enforcement logic
- `.github/actions/quality-gate/dist/run.js` — Updated bundle with comparison and comment posting
