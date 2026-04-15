---
title: CI Quality Gates
sidebar_label: CI Quality Gates
---

# CI Quality Gates

Quality gates enforce evaluation score thresholds on every pull request. When scores drop below your configured threshold, the gate fails the check and posts a detailed comment to the PR. This prevents regressions from merging undetected.

## How the Gate Works

```
1. Create experiment
   └─ Runs your evaluator(s) against your dataset

2. Poll for completion
   └─ Exponential backoff until the experiment finishes

3. Compare scores
   ├─ Check average score >= threshold
   └─ Optionally diff against a baseline experiment

4. Post PR comment
   └─ Per-evaluator scores, pass/fail badge, comparison URL

5. Enforce
   └─ Exit 1 if threshold not met — fails the workflow step
```

## GitHub Actions Setup

Add the Foxhound quality gate to your workflow using the composite action at `.github/actions/quality-gate`.

### Minimal Configuration

```yaml
name: AI Quality Gate

on:
  pull_request:
    branches: [main]

permissions:
  pull-requests: write

jobs:
  quality-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Foxhound Quality Gate
        uses: ./.github/actions/quality-gate
        with:
          api-key: ${{ secrets.FOXHOUND_API_KEY }}
          api-endpoint: https://api.foxhound.caleb-love.com
          dataset-id: ds_abc123
          experiment-config: |
            {
              "model": "gpt-4o",
              "temperature": 0.0
            }
          threshold: "0.8"
```

### With Baseline Comparison

Adding `baseline-experiment-id` enables regression detection. The gate compares your PR's scores against the baseline and reports the delta in the PR comment.

```yaml
      - name: Run Foxhound Quality Gate
        uses: ./.github/actions/quality-gate
        with:
          api-key: ${{ secrets.FOXHOUND_API_KEY }}
          api-endpoint: https://api.foxhound.caleb-love.com
          dataset-id: ds_abc123
          evaluator-ids: "eval_helpfulness_v2,eval_accuracy_v1"
          experiment-name: "pr-${{ github.event.pull_request.number }}"
          experiment-config: |
            {
              "model": "gpt-4o",
              "temperature": 0.0
            }
          threshold: "0.8"
          baseline-experiment-id: "exp_baseline_main"
          timeout: 600
```

## Input Reference

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `api-key` | Yes | — | Foxhound API key (`fox_...`), stored as a repository secret |
| `api-endpoint` | Yes | — | Foxhound API base URL (`https://api.foxhound.caleb-love.com`) |
| `dataset-id` | Yes | — | Dataset ID to run evaluations against |
| `evaluator-ids` | No | — | Comma-separated evaluator IDs. Omit to use all dataset evaluators |
| `experiment-name` | No | — | Human-readable name for this experiment run |
| `experiment-config` | Yes | — | JSON config for the experiment (model, temperature, etc.) |
| `threshold` | No | `0.0` | Minimum average score to pass (0.0–1.0) |
| `baseline-experiment-id` | No | — | Compare against this baseline. Adds regression info to PR comment |
| `timeout` | No | `600` | Max seconds to wait before failing |

## Outputs

| Output | Description |
|--------|-------------|
| `experiment-id` | The ID of the experiment created by this run |
| `comparison-url` | URL to the full comparison view in the Foxhound dashboard |

Use `comparison-url` in subsequent steps to link directly to the evaluation results.

## Setting Up a Baseline Experiment

The baseline is the experiment you compare PRs against — typically the last passing experiment on `main`.

**Option 1: Manual baseline via the dashboard**
Run an experiment from the Foxhound dashboard against your golden dataset. Copy the resulting `experiment-id` and add it as the `baseline-experiment-id` input.

**Option 2: Automated baseline on merge to main**

```yaml
name: Update Quality Gate Baseline

on:
  push:
    branches: [main]
    paths:
      - 'src/**'

jobs:
  update-baseline:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Create Baseline Experiment
        uses: ./.github/actions/quality-gate
        id: baseline
        with:
          api-key: ${{ secrets.FOXHOUND_API_KEY }}
          api-endpoint: https://api.foxhound.caleb-love.com
          dataset-id: ds_abc123
          experiment-name: "baseline-${{ github.sha }}"
          experiment-config: |
            { "model": "gpt-4o", "temperature": 0.0 }
          threshold: "0.0"

      - name: Store baseline experiment ID
        run: |
          echo "BASELINE_EXP_ID=${{ steps.baseline.outputs.experiment-id }}" >> $GITHUB_ENV
          # Store in your secrets store / variable for PRs to reference
```

## Threshold Selection

Start conservative and tighten over time:

| Stage | Recommended Threshold |
|-------|-----------------------|
| First setup | 0.6 — catch major regressions only |
| Stable product | 0.75–0.8 — good default |
| High-quality bar | 0.85–0.9 — for production-critical agents |

Run the gate in **warn-only mode** (threshold `0.0`) for a few weeks to build intuition before enforcing failures.

## Permissions

The action posts a PR comment and requires:

```yaml
permissions:
  pull-requests: write
```

Set this at the job or workflow level — not just on the step.

## Troubleshooting

**"Experiment timed out"** — Increase `timeout`. Large datasets or slow evaluators may need 900–1200 seconds.

**"Score below threshold"** — The PR comment includes per-evaluator breakdown. Use the `comparison-url` to open the full diff in the Foxhound dashboard.

**"Permission denied posting comment"** — Ensure `permissions: pull-requests: write` is set at the job or workflow level.

**Gate is too noisy** — Reduce your dataset to the most representative traces (20–50) or raise the `threshold` slowly rather than all at once.

## Related

- [Quality Gate Action Reference →](../ci-cd/quality-gate-action) — full action input/output reference
- [Dataset Curation →](./dataset-curation) — build the dataset the gate evaluates against
- [LLM-as-a-Judge →](./llm-as-a-judge) — configure evaluators used by the gate
- [MCP Server →](../mcp-server/setup) — query experiment results from your IDE
