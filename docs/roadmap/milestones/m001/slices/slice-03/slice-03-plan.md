# S03: GitHub Actions Quality Gate

**Goal:** Enable CI/CD quality gates for Foxhound evaluators by creating a GitHub Action that runs experiments on PRs, compares scores against a baseline, and fails the workflow if quality degrades below a threshold.
**Demo:** GitHub Action runs evaluators against dataset, fails PR if scores drop, posts comparison comment

## Must-Haves

- GitHub Action runs an experiment against a specified dataset on every PR
- Action polls the API until experiment completes (with timeout and error handling)
- Action retrieves score comparison between current and baseline experiments
- Action posts a PR comment with a markdown table showing score deltas
- Action exits non-zero if any evaluator score drops below the configured threshold
- Action handles missing baseline gracefully (first PR scenario)
- Documentation includes example workflow and input reference

## Threat Surface

- **Abuse**: Parameter tampering via experiment-config input could trigger expensive LLM calls, but cost is bounded by experiment worker rate limits (20 jobs/min). No privilege escalation risk.
- **Data exposure**: API key passed as secret input (properly masked). Experiment config may contain model names/params (logged for debugging, not sensitive).
- **Input trust**: dataset-id and evaluator-ids come from workflow file (trusted), experiment-config is user-controlled JSON (validated by API server).

## Requirement Impact

- **Requirements touched**: None — this is new CI/CD capability, doesn't modify existing requirements
- **Re-verify**: N/A
- **Decisions revisited**: None

## Proof Level

- This slice proves: integration
- Real runtime required: yes (GitHub Actions runner, live API)
- Human/UAT required: yes (manual PR test to verify comment posting and threshold enforcement)

## Verification

- `test -f .github/actions/quality-gate/action.yml` — action definition exists
- `test -f .github/actions/quality-gate/dist/run.js` — bundled script exists
- `grep -q 'createExperiment' .github/actions/quality-gate/dist/run.js` — API client bundled
- `test -f .github/actions/quality-gate/README.md` — documentation exists
- `test -f .github/workflows/quality-gate-example.yml` — example workflow exists
- Manual E2E: Open a test PR, trigger quality-gate action, verify PR comment appears with score table and workflow passes/fails based on threshold

## Observability / Diagnostics

- Runtime signals: GitHub Actions workflow logs (experiment creation, polling status transitions, score comparisons), step summary markdown with score table
- Inspection surfaces: `$GITHUB_STEP_SUMMARY` (persistent markdown report), action outputs (experiment-id, comparison-url), PR comment (user-facing score delta table)
- Failure visibility: Experiment status (pending/running/completed/failed), poll timeout error with last known status, API errors with status codes and messages, threshold violation details (which evaluators failed, by how much)
- Redaction constraints: API key passed via secret input (never logged), experiment config may contain model params (logged for debugging, not sensitive)

## Integration Closure

- Upstream surfaces consumed: `@foxhound/api-client` (FoxhoundApiClient class with createExperiment, getExperiment, compareExperiments methods), `@foxhound/types` (Experiment, ExperimentRun, ExperimentStatus, ExperimentComparisonResponse types)
- New wiring introduced: Composite GitHub Action in `.github/actions/quality-gate/` with bundled API client script (esbuild creates standalone run.js with all dependencies inlined)
- What remains: None — action is self-contained and ready for use in any GitHub workflow with appropriate permissions (pull-requests: write) and API credentials (FOXHOUND_API_KEY secret)

## Tasks

- [x] **T01: Create action scaffold and bundled API client script** `est:45m`
  - Why: Establish the composite action structure and prove that the API client can be bundled into a standalone script without npm install at runtime
  - Files: `.github/actions/quality-gate/action.yml`, `.github/actions/quality-gate/run.ts`, `.github/actions/quality-gate/package.json`, `.github/actions/quality-gate/tsconfig.json`, `.github/actions/quality-gate/.gitignore`
  - Do: Create action.yml with inputs (api-key, api-endpoint, dataset-id, evaluator-ids, experiment-name, experiment-config, threshold, baseline-experiment-id), outputs (experiment-id, comparison-url), and composite steps that run `node dist/run.js`. Create run.ts with FoxhoundApiClient import and basic structure (parse inputs from env vars, log startup). Add package.json with esbuild, typescript, and workspace dependencies (@foxhound/api-client, @foxhound/types). Configure tsconfig.json for ESNext + Node20. Add build script that runs `esbuild run.ts --bundle --platform=node --outfile=dist/run.js`. Run build to prove bundling works.
  - Verify: `test -f .github/actions/quality-gate/action.yml && test -f .github/actions/quality-gate/dist/run.js && grep -q 'createExperiment' .github/actions/quality-gate/dist/run.js`
  - Done when: action.yml defines all required inputs, run.ts imports API client successfully, esbuild produces a standalone bundle that includes FoxhoundApiClient code (verifiable via grep)

- [x] **T02: Implement experiment creation and polling logic** `est:1h`
  - Why: Core action functionality — create experiment, wait for completion, handle all error cases
  - Files: `.github/actions/quality-gate/run.ts`
  - Do: Parse inputs from process.env (INPUT_API_KEY, INPUT_DATASET_ID, etc.). Create FoxhoundApiClient instance. Call createExperiment with dataset-id, name, and config. Parse experimentId from response. Implement pollExperiment function with exponential backoff (start 2s, max 30s, timeout default 600s configurable). Poll getExperiment until status is "completed" or "failed". Handle timeout (exit 1 with "Experiment timed out after 600s" error). Handle failed status (exit 1 with experiment error). Write experiment-id to $GITHUB_OUTPUT. Log each poll attempt with status and elapsed time. Add specific error messages for common API failures (401 -> "Invalid API key", 403 -> "Org lacks canEvaluate entitlement", 500 -> "API server error").
  - Verify: `grep -q 'createExperiment' .github/actions/quality-gate/run.ts && grep -q 'pollExperiment' .github/actions/quality-gate/run.ts && grep -q 'exponential' .github/actions/quality-gate/run.ts`
  - Done when: Script creates experiment via API, polls with exponential backoff until status is terminal, handles all failure modes with actionable errors, writes experiment-id to GitHub output

- [x] **T03: Add score comparison and PR comment posting** `est:1h 15m`
  - Why: Delivers the core value proposition — surface score deltas in PR context and enforce quality thresholds
  - Files: `.github/actions/quality-gate/run.ts`
  - Do: If baseline-experiment-id is provided, call compareExperiments([baselineId, currentId]). Parse ExperimentComparisonResponse (experiments, runs, items, scores arrays). Group scores by evaluator name and compute aggregates (mean for each experiment). Format as markdown table: `| Evaluator | Baseline | Current | Delta | Status |` with emoji (✅ improved/unchanged, ⚠️ degraded but above threshold, ❌ below threshold). If no baseline, format table without delta column. Post comment using @actions/github (or raw fetch to github.rest.issues.createComment with GITHUB_TOKEN from env and issue number from github.context). Search for existing comment (look for hidden HTML marker `<!-- foxhound-quality-gate -->`), update if found, create new if not. Write comparison table to $GITHUB_STEP_SUMMARY. Compute threshold violations (scores below threshold) and exit 1 if any found, logging which evaluators failed. Write comparison-url output.
  - Verify: `grep -q 'compareExperiments' .github/actions/quality-gate/run.ts && grep -q 'github.issues.createComment' .github/actions/quality-gate/run.ts && grep -q 'threshold' .github/actions/quality-gate/run.ts`
  - Done when: Script compares experiments, formats markdown table with score deltas, posts PR comment (creates or updates), writes to step summary, enforces threshold and exits with correct code

- [x] **T04: Write documentation and example workflow** `est:45m`
  - Why: Make the action discoverable and usable — users need clear docs to configure it correctly
  - Files: `.github/actions/quality-gate/README.md`, `.github/workflows/quality-gate-example.yml`, `.github/actions/quality-gate/test.sh`
  - Do: Write README with: action description ("Run Foxhound evaluators on every PR, enforce quality thresholds"), inputs reference table (name | required | default | description) for all 8 inputs, outputs reference (experiment-id, comparison-url), permissions section (pull-requests: write required), usage example showing workflow YAML with uses: ./.github/actions/quality-gate and all inputs configured via secrets and vars, troubleshooting section (Missing OPENAI_API_KEY on worker -> contact admin; Org lacks canEvaluate -> upgrade to Pro plan; Experiment timeout -> increase timeout input; No baseline experiment -> use first run's ID for future PRs). Create .github/workflows/quality-gate-example.yml with realistic usage (on: pull_request, jobs that run action with dataset-id from var, api-key from secret, threshold 0.7). Create test.sh that mocks API responses with curl/http-server and runs the bundled script with fake inputs to verify comment formatting logic.
  - Verify: `test -f .github/actions/quality-gate/README.md && grep -q 'api-key' .github/actions/quality-gate/README.md && test -f .github/workflows/quality-gate-example.yml && grep -q 'quality-gate' .github/workflows/quality-gate-example.yml`
  - Done when: README has inputs table, usage example, troubleshooting section; example workflow is valid YAML and demonstrates realistic usage; test.sh exists and can run locally to verify script logic

## Files Likely Touched

- `.github/actions/quality-gate/action.yml`
- `.github/actions/quality-gate/run.ts`
- `.github/actions/quality-gate/package.json`
- `.github/actions/quality-gate/tsconfig.json`
- `.github/actions/quality-gate/.gitignore`
- `.github/actions/quality-gate/dist/run.js`
- `.github/actions/quality-gate/README.md`
- `.github/workflows/quality-gate-example.yml`
- `.github/actions/quality-gate/test.sh`
