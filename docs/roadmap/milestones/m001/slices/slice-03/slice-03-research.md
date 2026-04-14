# S03: GitHub Actions Quality Gate — Research

**Date:** 2026-04-10

## Summary

This slice creates a GitHub Action (`foxhound-ai/quality-gate-action`) that runs Foxhound evaluators against a dataset on every PR, fails the workflow if scores drop below a threshold, and posts a comparison comment on the PR. The spec places this in `.github/actions/quality-gate/`.

The full API surface for evaluators, experiments, datasets, and scores already exists in the monorepo. The `api-client` package (`packages/api-client/src/index.ts`) provides typed methods for every endpoint the action needs: `createExperiment`, `compareExperiments`, `listEvaluators`, `triggerEvaluatorRuns`, and `queryScores`. The CLI (`packages/cli`) currently has no eval/experiment commands, so the action should use the API client directly rather than wrapping CLI commands.

Braintrust's `eval-action` is the competitive reference. Their pattern: a composite action that runs evals, collects experiment results, and posts a PR comment with score deltas. Foxhound should match this UX but leverage the existing experiment comparison endpoint (`GET /v1/experiment-comparisons?experiment_ids=A,B`) which already returns side-by-side runs, dataset items, and scores.

## Recommendation

Build a **composite GitHub Action** (YAML-based with shell steps) that uses Node.js scripts to call the Foxhound API. A composite action avoids the overhead of a full JavaScript action (no `@actions/core` build step, no `dist/` bundling) while still enabling typed API calls via the existing `api-client` package.

The action should:
1. Accept inputs: `api-key`, `api-endpoint`, `dataset-id`, `evaluator-ids` (optional, defaults to all enabled), `experiment-name` (optional, defaults to PR-based), `experiment-config` (JSON), `threshold` (numeric, default 0.0), `baseline-experiment-id` (optional, for comparison).
2. Create a new experiment against the specified dataset via `POST /v1/experiments`.
3. Poll until the experiment completes (status transitions: pending -> running -> completed/failed).
4. If a baseline experiment ID is provided, call `GET /v1/experiment-comparisons` to get score deltas.
5. Post a PR comment via the GitHub API (`github.rest.issues.createComment`) with a markdown table of scores.
6. Exit non-zero if any evaluator's average score drops below the threshold vs baseline.

A lightweight Node.js script (not a full `@actions/core` JavaScript action) is the right call — it can import `@foxhound/api-client` directly, avoids shell-based JSON parsing fragility, and still runs inside the composite action's `run` steps via `node script.js`.

## Implementation Landscape

### Key Files

**Existing (read-only context for the action):**
- `packages/api-client/src/index.ts` (lines 436-461) — `createExperiment`, `getExperiment`, `compareExperiments` methods. The action calls these directly.
- `packages/api-client/src/types.ts` (lines 219-239) — `ExperimentComparisonResponse` type: `{experiments, runs, items, scores}`. This is what the comparison comment will render.
- `apps/api/src/routes/experiments.ts` (lines 122-141) — `GET /v1/experiment-comparisons` endpoint. Requires 2+ experiment IDs, returns cross-experiment data.
- `apps/api/src/routes/evaluators.ts` (lines 78-85) — `GET /v1/evaluators` returns all evaluators for the org. The action needs this to list enabled evaluators.
- `apps/worker/src/queues/experiment.ts` (lines 154-230) — Experiment execution flow. Runs dataset items through LLM, then auto-scores with enabled evaluators. The action doesn't touch this but must wait for it to complete.
- `packages/types/src/index.ts` (lines 147-169) — `ExperimentStatus`, `Experiment`, `ExperimentRun` types.

**New files to create:**
- `.github/actions/quality-gate/action.yml` — Composite action definition with inputs, outputs, and steps.
- `.github/actions/quality-gate/run.ts` — Main script: create experiment, poll, compare, format comment, exit code.
- `.github/actions/quality-gate/package.json` — Minimal deps: `@foxhound/api-client`, `@foxhound/types`.
- `.github/actions/quality-gate/tsconfig.json` — TypeScript config for the action script.
- `.github/actions/quality-gate/README.md` — Usage docs with example workflow YAML.

### Build Order

1. **Action scaffold + experiment creation** (riskiest, unblocks everything). Create `action.yml` with inputs, write the script that creates an experiment and polls for completion. This proves the API integration works end-to-end. Verify: experiment status reaches `completed` in test.
2. **Comparison logic + comment formatting**. Call `compareExperiments`, compute score deltas, format markdown table. This is the core value — users see score changes on their PR.
3. **Threshold enforcement + PR comment posting**. Use `@actions/github` (or raw GitHub API via `GITHUB_TOKEN`) to post the comment. Set exit code based on threshold comparison. This completes the quality gate.
4. **Documentation + example workflow**. Write README with usage example, add an example workflow to `.github/workflows/` showing the action in a real CI pipeline.

### Verification Approach

- **Unit test**: Mock the API client, verify comment formatting logic produces correct markdown for various score scenarios (improvement, regression, no change, missing baseline).
- **Integration test**: Against a running Foxhound API (local dev), create a dataset with items, run the action script, verify experiment is created and comparison data is retrieved.
- **Manual E2E**: Open a PR on the repo, trigger the action, verify the PR comment appears with correct scores and the workflow passes/fails based on threshold.
- **Command**: `cd .github/actions/quality-gate && npx tsx run.ts --dry-run` for local testing without GitHub context.

## Don't Hand-Roll

| Problem | Existing Solution | Why Use It |
|---------|------------------|------------|
| Foxhound API calls | `@foxhound/api-client` (`FoxhoundApiClient`) | Typed, tested, handles auth + error formatting |
| PR comment posting | `@actions/github` package or `gh api` CLI | Standard GitHub Actions pattern, handles token auth |
| Experiment execution | Worker queue (`apps/worker/src/queues/experiment.ts`) | Already runs dataset items through LLM + auto-scores with evaluators |
| Score comparison | `GET /v1/experiment-comparisons` endpoint | Already joins experiments, runs, items, and scores |

## Constraints

- **Experiment execution is async**: The API returns 202 with a queued experiment. The action must poll `GET /v1/experiments/:id` until `status === "completed"` or `"failed"`. Need a timeout (default ~10 minutes).
- **OPENAI_API_KEY needed on the worker**: Experiments call OpenAI for LLM execution and evaluation. The worker must have this key configured. The GitHub Action itself doesn't need it — the server-side worker does.
- **Entitlements**: Evaluator endpoints require `canEvaluate` entitlement (Pro+ plan). The action should surface a clear error if the org's plan doesn't include evaluators.
- **Composite action limitation**: Composite actions can't use `@actions/core` directly (that's for JavaScript actions). The script runs via `node` in a shell step, so it writes to `$GITHUB_OUTPUT` and `$GITHUB_STEP_SUMMARY` via file appends instead of `core.setOutput()`.
- **GitHub token permissions**: Posting PR comments requires `pull-requests: write` permission in the workflow. The action README must document this.

## Common Pitfalls

- **Polling without timeout** — Experiments can hang if the worker is down. Implement exponential backoff polling with a hard timeout (default 600s, configurable). Fail with a clear "experiment timed out" message.
- **No baseline experiment** — First run on a repo has no baseline to compare against. The action should still succeed, post scores without deltas, and suggest using this run as a baseline for future PRs.
- **Score comment matching** — The `getExperimentComparison` query joins scores via `comment` field containing run IDs (`sql WHERE scores.comment = ANY(runIds)`). This is fragile — scores from evaluator runs use `comment` format like `"experiment:{expId} run:{runId}"`. The comparison endpoint may not return scores correctly. Verify this works or use `queryScores` per-trace as fallback.
- **Stale PR comments** — Multiple pushes to a PR create multiple comments. The action should find and update an existing comment (search for a hidden marker like `<!-- foxhound-quality-gate -->`) rather than creating duplicates.
- **Rate limiting on evaluator LLM calls** — Large datasets (100+ items) with multiple evaluators can hit OpenAI rate limits on the worker side. The worker already has a rate limiter (20 jobs/min), but the action's timeout needs to account for this.

## Open Risks

- **Experiment comparison data quality**: The `getExperimentComparison` DB query joins scores by matching `scores.comment = ANY(runIds)` which is an indirect link. If the auto-scoring in the experiment worker uses a different comment format, scores may be missing from comparisons. Need to verify this path end-to-end.
- **Cross-PR baseline management**: The action needs a way to identify "the last successful experiment on the base branch" for comparison. This might require a new API endpoint or convention (e.g., experiments named `main-{sha}` or a "pin as baseline" API).
- **Package resolution in composite action**: The action script imports `@foxhound/api-client` which is a workspace package. When the action runs in a consumer's repo (not the monorepo), the package must be installed from npm. The action needs its own `package.json` with `@foxhound-ai/api-client` as a published dependency, or bundle the script.

## Skills Discovered

No directly relevant GitHub Actions skills found in the skill registry.

## Sources

- Composite action best practices (source: [GitHub Docs — Creating a composite action](https://docs.github.com/actions/creating-actions/creating-a-composite-action))
- Braintrust eval-action reference implementation (source: [Braintrust eval-action on GitHub Marketplace](https://github.com/marketplace/actions/braintrust-eval-action))
- Braintrust CI/CD quality gate article (source: [Best AI evals tools for CI/CD — Braintrust](https://www.braintrust.dev/articles/best-ai-evals-tools-cicd-2025))
- GitHub Actions action types comparison (source: [About custom actions — GitHub Docs](https://docs.github.com/en/actions/sharing-automations/creating-actions/about-custom-actions))
- Foxhound strategic roadmap spec section 5.2 (source: `docs/superpowers/specs/2026-04-10-foxhound-strategic-roadmap-design.md`)
