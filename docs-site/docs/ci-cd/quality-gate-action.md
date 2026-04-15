---
title: Quality Gate Action
sidebar_label: Quality Gate Action
---

# CI/CD Quality Gate Action

The Foxhound quality gate GitHub Actions composite action enforces evaluation score thresholds on every pull request. When scores fall below your configured threshold, the action fails the check and posts a summary comment to the PR.

## Overview

The action:
1. Creates a new evaluation experiment from your dataset + evaluator config
2. Polls with exponential backoff until the experiment completes
3. Compares scores against the threshold (and optionally against a baseline experiment)
4. Posts a detailed PR comment with results
5. Fails the workflow step if scores are below threshold

## Usage

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
          evaluator-ids: "eval_helpfulness,eval_accuracy"
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

## Inputs

| Input                    | Required | Default | Description                                                             |
|--------------------------|----------|---------|-------------------------------------------------------------------------|
| `api-key`                | Yes      | —       | Your Foxhound API key (`fox_...`)                                       |
| `api-endpoint`           | Yes      | —       | Foxhound API base URL                                                   |
| `dataset-id`             | Yes      | —       | Dataset ID to run evaluations against                                   |
| `evaluator-ids`          | No       | —       | Comma-separated evaluator IDs. Omit to use all dataset evaluators       |
| `experiment-name`        | No       | —       | Human-readable name for this experiment run                             |
| `experiment-config`      | Yes      | —       | JSON config for the experiment (model, temperature, etc.)               |
| `threshold`              | No       | `0.0`   | Minimum average score to pass (0.0–1.0). Fail if below.                |
| `baseline-experiment-id` | No       | —       | Compare scores against this baseline experiment. Adds regression info.  |
| `timeout`                | No       | `600`   | Max seconds to wait for experiment completion before failing            |

## Outputs

| Output              | Description                                                     |
|---------------------|-----------------------------------------------------------------|
| `experiment-id`     | The ID of the experiment created by this run                    |
| `comparison-url`    | URL to the full comparison view in the Foxhound dashboard       |

## Permissions

The action posts a PR comment and requires:

```yaml
permissions:
  pull-requests: write
```

Add this at the job or workflow level.

## How it works

```
1. Create experiment
   └─ POST /experiments with dataset-id, evaluator-ids, experiment-config

2. Poll for completion (exponential backoff, up to `timeout` seconds)
   └─ GET /experiments/{id}/status

3. Compare scores
   ├─ If baseline-experiment-id is set: compare score delta
   └─ Check average score >= threshold

4. Post PR comment
   └─ Includes per-evaluator scores, pass/fail badge, comparison-url

5. Fail step if threshold not met
   └─ exit 1 when avg_score < threshold
```

## Troubleshooting

**"Experiment timed out"** — Increase `timeout` to allow more time for large datasets or slow evaluators.

**"Score below threshold"** — Review the PR comment for per-evaluator breakdown. Use the `comparison-url` output to open the full diff in the Foxhound dashboard.

**"Permission denied posting comment"** — Ensure `permissions: pull-requests: write` is set at the job or workflow level.

**"Invalid experiment-config"** — `experiment-config` must be valid JSON. Validate with `echo '${{ inputs.experiment-config }}' | jq .` in a debug step.

## Related

- [MCP Server →](../mcp-server/setup) — query experiments and scores from your IDE
- [Evaluation Cookbook: CI Quality Gates →](../evaluation-cookbook/ci-quality-gates)
