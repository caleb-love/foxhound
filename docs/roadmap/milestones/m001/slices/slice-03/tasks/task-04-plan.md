---
estimated_steps: 4
estimated_files: 3
skills_used: []
---

# T04: Write documentation and example workflow

**Slice:** S03 — GitHub Actions Quality Gate
**Milestone:** M001

## Description

Create comprehensive README with: action description, inputs reference table (name, required, default, description), outputs reference, usage example showing workflow YAML with quality-gate action step, permissions requirements (pull-requests: write), troubleshooting section (common errors like missing OPENAI_API_KEY, entitlement check failure, timeout). Create example workflow file in .github/workflows/quality-gate-example.yml showing realistic usage with dataset-id and evaluator-ids. Add test script for local dry-run testing without GitHub context.

This task makes the action discoverable and usable — clear documentation is critical for developer adoption.

## Steps

1. Write `.github/actions/quality-gate/README.md`:
   - **Header**: "# Foxhound Quality Gate Action"
   - **Description**: "Run Foxhound evaluators on every PR. Automatically compares scores against a baseline and fails the workflow if quality degrades below a threshold. Posts score comparison as a PR comment."
   - **Inputs table**:
     | Input | Required | Default | Description |
     |-------|----------|---------|-------------|
     | api-key | Yes | - | Foxhound API key (use secrets.FOXHOUND_API_KEY) |
     | api-endpoint | Yes | - | Foxhound API endpoint (e.g. https://api.foxhound.dev) |
     | dataset-id | Yes | - | Dataset ID to run experiments against |
     | evaluator-ids | No | all enabled | Comma-separated evaluator IDs (e.g. eval_abc,eval_xyz) |
     | experiment-name | No | "PR #{number}" | Name for the experiment |
     | experiment-config | Yes | - | JSON config for experiment (model, params) |
     | threshold | No | 0.0 | Minimum acceptable score (0.0-1.0) |
     | baseline-experiment-id | No | - | Baseline experiment ID for comparison |
   - **Outputs table**:
     | Output | Description |
     |--------|-------------|
     | experiment-id | ID of the created experiment |
     | comparison-url | URL to view score comparison in Foxhound UI |
   - **Permissions section**: "Requires `pull-requests: write` permission to post comments."
   - **Usage example**:
     ```yaml
     name: Quality Gate
     on: pull_request
     permissions:
       pull-requests: write
     jobs:
       foxhound:
         runs-on: ubuntu-latest
         steps:
           - uses: actions/checkout@v4
           - uses: ./.github/actions/quality-gate
             with:
               api-key: ${{ secrets.FOXHOUND_API_KEY }}
               api-endpoint: https://api.foxhound.dev
               dataset-id: ds_abc123
               experiment-config: '{"model": "gpt-4", "temperature": 0.7}'
               threshold: 0.75
               baseline-experiment-id: exp_baseline
     ```
   - **Troubleshooting section**:
     - "Experiment timed out": "Increase `timeout` input or check worker status"
     - "Missing OPENAI_API_KEY on worker": "Contact Foxhound admin to configure worker env vars"
     - "Org lacks canEvaluate entitlement": "Upgrade to Pro plan at app.foxhound.dev/billing"
     - "No baseline experiment": "On first run, note the experiment-id output and use it as baseline-experiment-id for future PRs"
     - "GitHub API 403 (comment posting)": "Add `pull-requests: write` to workflow permissions"
2. Write `.github/workflows/quality-gate-example.yml`:
   - Realistic workflow that runs on pull_request events
   - Uses secrets.FOXHOUND_API_KEY and vars.FOXHOUND_DATASET_ID
   - Shows how to set baseline-experiment-id from a previous successful run
   - Includes permissions: pull-requests: write
3. Write `.github/actions/quality-gate/test.sh`:
   - Mock API responses using curl or simple http-server
   - Run bundled script with fake INPUT_* env vars
   - Verify markdown formatting logic produces correct output
   - Capture output to file, grep for expected patterns (table headers, emoji)
4. Commit all docs (README, example workflow, test script)

## Must-Haves

- [ ] README.md has inputs table with all 8 inputs documented
- [ ] README.md has outputs table with experiment-id and comparison-url
- [ ] README.md has usage example with complete workflow YAML
- [ ] README.md has permissions section explaining pull-requests: write
- [ ] README.md has troubleshooting section with 4+ common errors and solutions
- [ ] quality-gate-example.yml is valid workflow YAML demonstrating action usage
- [ ] test.sh exists and can run locally to verify script logic

## Verification

```bash
test -f .github/actions/quality-gate/README.md && \
grep -q 'api-key' .github/actions/quality-gate/README.md && \
test -f .github/workflows/quality-gate-example.yml && \
grep -q 'quality-gate' .github/workflows/quality-gate-example.yml
```

## Inputs

- `.github/actions/quality-gate/action.yml` — Inputs/outputs definitions to document
- `.github/actions/quality-gate/run.ts` — Implementation details for troubleshooting section

## Expected Output

- `.github/actions/quality-gate/README.md` — Complete documentation with inputs table, usage example, permissions, troubleshooting (1000+ words)
- `.github/workflows/quality-gate-example.yml` — Realistic example workflow showing action usage with secrets and vars
- `.github/actions/quality-gate/test.sh` — Local test script for verifying markdown formatting logic
