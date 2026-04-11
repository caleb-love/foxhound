---
title: LLM-as-a-Judge
sidebar_label: LLM-as-a-Judge
---

# LLM-as-a-Judge

LLM-as-a-Judge evaluators let you score traces automatically using a language model as the judge. Foxhound runs evaluators asynchronously — you trigger a run against a set of trace IDs and poll for results.

## How It Works

1. **List** available evaluators in your organization with `foxhound_list_evaluators`
2. **Trigger** a run against 1–50 traces with `foxhound_run_evaluator`
3. **Poll** for completion with `foxhound_get_evaluator_run`
4. **View** resulting scores on the traces

Each evaluator run is assigned a `run_id`. Runs are async — they may complete in seconds or take a few minutes depending on trace count and evaluator complexity.

## Step 1: List Your Evaluators

Use `foxhound_list_evaluators` to see all evaluators configured for your organization:

```
List my evaluators
```

The response shows evaluator IDs, names, dimensions scored, and the judge model used. Note the `evaluator_id` values — you'll need them to trigger runs.

### Parameters

`foxhound_list_evaluators` takes no parameters.

### Example Response

```
Evaluators:
  eval_helpfulness_v2   — scores: helpfulness (gpt-4o)
  eval_accuracy_v1      — scores: accuracy (gpt-4o)
  eval_safety_v1        — scores: safety (claude-3-5-sonnet)
```

## Step 2: Trigger an Evaluator Run

Use `foxhound_run_evaluator` to score one or more traces. You can provide 1–50 trace IDs per run.

```
Run evaluator eval_helpfulness_v2 on traces [trace-001, trace-002, trace-003]
```

### Parameters

| Parameter      | Type       | Required | Description |
|----------------|------------|----------|-------------|
| `evaluator_id` | string     | Yes | The evaluator to run (from `foxhound_list_evaluators`) |
| `trace_ids`    | string[]   | Yes | List of 1–50 trace IDs to evaluate |

### Example Response

```
Evaluator run started:
  run_id:       run_abc789
  evaluator:    eval_helpfulness_v2
  traces:       3
  status:       ⏳ pending
```

The run starts immediately. Polling is required to get results.

## Step 3: Poll for Results

Use `foxhound_get_evaluator_run` to check status and retrieve scores:

```
Check the status of evaluator run run_abc789
```

### Parameters

| Parameter | Type   | Required | Description |
|-----------|--------|----------|-------------|
| `run_id`  | string | Yes | The evaluator run ID returned by `foxhound_run_evaluator` |

### Status Values

| Status | Meaning |
|--------|---------|
| ⏳ `pending` | Run is queued |
| ⏳ `running` | Evaluations in progress |
| ✅ `complete` | All traces scored |
| ❌ `failed` | Run failed — check error message |

Poll every 5–15 seconds until status is `complete` or `failed`. Most runs complete within 30–60 seconds for small batches.

### Example Completed Response

```
Evaluator run run_abc789:
  status:    ✅ complete
  evaluator: eval_helpfulness_v2
  results:
    trace-001  helpfulness: 0.92  "Correctly identified user intent and gave step-by-step guidance"
    trace-002  helpfulness: 0.71  "Partially addressed the question; missed the edge case"
    trace-003  helpfulness: 0.45  "Off-topic response — agent misread the tool output"
```

## Scoring a Large Batch

If you have more than 50 traces, split them into batches:

```
# Batch 1
Run evaluator eval_helpfulness_v2 on traces [trace-001, ..., trace-050]

# After batch 1 completes, start batch 2
Run evaluator eval_helpfulness_v2 on traces [trace-051, ..., trace-100]
```

For high-volume evaluation across your full trace history, use the Foxhound dashboard's bulk evaluation UI or the REST API directly.

## Reading Scores After a Run

Once a run is complete, scores are attached to the traces and readable via `foxhound_get_trace_scores`:

```
Show me all scores for trace trace-001
```

This lets you compare manual scores and evaluator scores side-by-side on the same trace.

## Evaluator Configuration

Evaluators are configured in the Foxhound dashboard (Settings → Evaluators). Each evaluator specifies:

- **Judge model** — which LLM to use (gpt-4o, claude-3-5-sonnet, etc.)
- **Scoring prompt** — the system prompt given to the judge
- **Dimensions** — which score dimensions the evaluator writes
- **Input fields** — which trace fields the judge sees (e.g. input, output, tool_calls)

Contact your Foxhound admin or the dashboard to create new evaluators.

## Async Execution Details

Evaluator runs are always async because:
- The judge LLM must be invoked once per trace (or per span, depending on evaluator config)
- Results are persisted to the database before being returned
- Large batches (50 traces) may involve 50+ LLM calls

Never assume a run is complete immediately after `foxhound_run_evaluator` returns. Always poll with `foxhound_get_evaluator_run`.

## Related

- [MCP Tool Reference →](../mcp-server/tool-reference) — full parameter reference for evaluator tools
- [CI Quality Gates →](./ci-quality-gates) — run evaluators automatically on every PR
- [Dataset Curation →](./dataset-curation) — build a dataset to evaluate against
