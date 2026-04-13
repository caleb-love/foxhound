# Foxhound Quality Gate Action

Run Foxhound evaluators on every PR. Automatically compares scores against a baseline and fails the workflow if quality degrades below a threshold. Posts score comparison as a PR comment.

## Overview

This GitHub Action integrates Foxhound's LLM evaluation platform into your CI/CD pipeline. When a pull request is opened or updated, the action:

1. Creates a new experiment in Foxhound using your dataset and evaluators
2. Polls until the experiment completes (or times out)
3. Compares scores against a baseline experiment
4. Posts a detailed score comparison table as a PR comment
5. Fails the workflow if any evaluator scores fall below the threshold

This ensures LLM-powered features maintain quality standards before merging to production.

## Inputs

| Input                    | Required | Default        | Description                                                                                                                                     |
| ------------------------ | -------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `api-key`                | Yes      | -              | Foxhound API key. Use `${{ secrets.FOXHOUND_API_KEY }}` to keep it secure.                                                                      |
| `api-endpoint`           | Yes      | -              | Foxhound API endpoint (e.g. `https://api.foxhound.dev`)                                                                                         |
| `dataset-id`             | Yes      | -              | Dataset ID to run experiments against (e.g. `ds_abc123`)                                                                                        |
| `evaluator-ids`          | No       | all enabled    | Comma-separated evaluator IDs (e.g. `eval_abc,eval_xyz`). If omitted, runs all evaluators enabled for the dataset.                              |
| `experiment-name`        | No       | `PR #{number}` | Name for the experiment shown in Foxhound UI. Defaults to PR number.                                                                            |
| `experiment-config`      | Yes      | -              | JSON configuration for experiment (e.g. `{"model": "gpt-4", "temperature": 0.7}`)                                                               |
| `threshold`              | No       | `0.0`          | Minimum acceptable score (0.0-1.0). Workflow fails if any evaluator scores below this. Use `0.0` to never fail, `0.75` for 75% minimum quality. |
| `baseline-experiment-id` | No       | -              | Baseline experiment ID for comparison (e.g. `exp_baseline`). If omitted, no comparison is shown.                                                |
| `timeout`                | No       | `600`          | Maximum seconds to wait for experiment completion before failing.                                                                               |

## Outputs

| Output           | Description                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------- |
| `experiment-id`  | ID of the created experiment (e.g. `exp_xyz789`). Use this as `baseline-experiment-id` for future runs. |
| `comparison-url` | URL to view the score comparison in the Foxhound UI (if baseline was provided).                         |

## Permissions

This action requires the `pull-requests: write` permission to post comments on pull requests.

```yaml
permissions:
  pull-requests: write
```

If your workflow runs on `pull_request` events from forks, you'll need to use `pull_request_target` instead and explicitly grant this permission.

## Usage

### Basic Example

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
          baseline-experiment-id: exp_baseline_xyz
```

### Advanced Example with Dynamic Baseline

This example stores the experiment ID from the main branch as a baseline, then uses it for PR comparisons:

```yaml
name: Quality Gate
on:
  push:
    branches: [main]
  pull_request:

permissions:
  pull-requests: write
  contents: write

jobs:
  foxhound:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Quality Gate
        id: quality-gate
        uses: ./.github/actions/quality-gate
        with:
          api-key: ${{ secrets.FOXHOUND_API_KEY }}
          api-endpoint: ${{ vars.FOXHOUND_API_ENDPOINT }}
          dataset-id: ${{ vars.FOXHOUND_DATASET_ID }}
          evaluator-ids: eval_accuracy,eval_safety,eval_latency
          experiment-config: |
            {
              "model": "gpt-4-turbo",
              "temperature": 0.7,
              "max_tokens": 1000
            }
          threshold: 0.80
          baseline-experiment-id: ${{ vars.BASELINE_EXPERIMENT_ID }}
          timeout: 900

      - name: Update baseline on main
        if: github.ref == 'refs/heads/main' && success()
        run: |
          echo "BASELINE_EXPERIMENT_ID=${{ steps.quality-gate.outputs.experiment-id }}" >> $GITHUB_ENV
          # Store as repository variable for future runs
          gh variable set BASELINE_EXPERIMENT_ID --body "${{ steps.quality-gate.outputs.experiment-id }}"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Selective Evaluator Testing

Run only specific evaluators for faster feedback:

```yaml
- uses: ./.github/actions/quality-gate
  with:
    api-key: ${{ secrets.FOXHOUND_API_KEY }}
    api-endpoint: https://api.foxhound.dev
    dataset-id: ds_abc123
    evaluator-ids: eval_fast_smoke_test,eval_critical_safety
    experiment-config: '{"model": "gpt-4"}'
    threshold: 0.90
    timeout: 300
```

## Troubleshooting

### "Experiment timed out"

**Cause:** The experiment didn't complete within the `timeout` period (default 600 seconds).

**Solutions:**

- Increase the `timeout` input to allow more time (e.g. `timeout: 1200` for 20 minutes)
- Check Foxhound worker status in the admin dashboard
- Reduce dataset size or number of evaluators for faster runs
- Check if workers are configured with sufficient API quota (e.g. OpenAI rate limits)

### "Missing OPENAI_API_KEY on worker"

**Cause:** Foxhound workers need API keys to run LLM evaluations, but the worker doesn't have `OPENAI_API_KEY` configured.

**Solutions:**

- Contact your Foxhound administrator to configure environment variables on workers
- Check worker configuration at `app.foxhound.dev/admin/workers`
- Verify the worker pool has the required API keys for your experiment's model provider

### "Org lacks canEvaluate entitlement"

**Cause:** Your organization's Foxhound plan doesn't include the evaluation API.

**Solutions:**

- Upgrade to a Pro or Enterprise plan at `app.foxhound.dev/billing`
- Contact Foxhound sales for enterprise pricing
- Use the free tier for development datasets (limits apply)

### "No baseline experiment" or empty comparison table

**Cause:** The `baseline-experiment-id` input is not provided, or the experiment ID doesn't exist.

**Solutions:**

- On the first run, note the `experiment-id` output from the action logs
- Store it as a repository variable: `gh variable set BASELINE_EXPERIMENT_ID --body "exp_xyz789"`
- Use it in subsequent runs: `baseline-experiment-id: ${{ vars.BASELINE_EXPERIMENT_ID }}`
- Alternatively, run an experiment manually in Foxhound UI and use its ID as the baseline

### "GitHub API 403 (comment posting)" or "Resource not accessible by integration"

**Cause:** The workflow doesn't have permission to post comments on pull requests.

**Solutions:**

- Add `pull-requests: write` to the workflow's `permissions` section:
  ```yaml
  permissions:
    pull-requests: write
  ```
- If running on `pull_request` events from forks, use `pull_request_target` instead:
  ```yaml
  on:
    pull_request_target:
      types: [opened, synchronize]
  ```
- For organization repos, check that GitHub Actions has the required permissions in repository settings

### "Failed to create experiment: 401 Unauthorized"

**Cause:** The `api-key` is invalid or expired.

**Solutions:**

- Verify the secret is correctly set: `gh secret set FOXHOUND_API_KEY`
- Generate a new API key at `app.foxhound.dev/settings/api-keys`
- Check that the key has the `experiments:create` scope

### "Failed to create experiment: 404 Not Found" (dataset or evaluator)

**Cause:** The `dataset-id` or one of the `evaluator-ids` doesn't exist or isn't accessible.

**Solutions:**

- Verify dataset ID in Foxhound UI datasets list
- Check evaluator IDs are correctly spelled and enabled for the dataset
- Ensure the API key has access to the specified dataset (check dataset permissions)

### Workflow passes but scores are low

**Cause:** The `threshold` is set too low (or to default `0.0`).

**Solutions:**

- Set a meaningful threshold based on your quality requirements (e.g. `threshold: 0.75` for 75% minimum)
- Review the score comparison table in the PR comment to understand current quality
- Adjust the threshold iteratively as you establish quality baselines

## How It Works

1. **Experiment Creation:** The action calls the Foxhound API to create a new experiment with your dataset, evaluators, and model configuration.

2. **Polling:** The action polls the experiment status every 10 seconds (with exponential backoff) until it reaches `completed` or `failed` status, or the timeout is reached.

3. **Score Comparison:** If a baseline experiment is provided, the action fetches both experiments' scores and calculates deltas (absolute and percentage change).

4. **PR Comment:** A markdown table is posted to the PR showing:
   - Each evaluator's score (current and baseline)
   - Score delta with emoji indicators (✅ improved, ⚠️ degraded, ➡️ unchanged)
   - Link to view full results in Foxhound UI

5. **Threshold Check:** If any evaluator's current score is below the threshold, the workflow fails with a clear error message.

## Development

### Local Testing

To test the action logic locally without GitHub Actions context:

```bash
cd .github/actions/quality-gate
./test.sh
```

This runs a dry-run with mock API responses to verify markdown formatting and threshold logic.

### Building

The action is bundled into a single JavaScript file for fast startup:

```bash
cd .github/actions/quality-gate
pnpm install
pnpm run build
```

This creates `dist/run.js` with all dependencies inlined.

## License

MIT
