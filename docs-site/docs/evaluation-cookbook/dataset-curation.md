---
title: Dataset Curation
sidebar_label: Dataset Curation
---

# Dataset Curation

A good evaluation dataset is a curated sample of traces that represents the range of behaviors you care about — successful runs, edge cases, and known failure modes. Foxhound provides two curation workflows: adding individual traces manually, and bulk-curating by score thresholds.

## Why Curate a Dataset?

- **Reproducible evaluation** — run the same evaluators against the same traces across versions
- **Regression detection** — catch quality drops when you change prompts, models, or tools
- **Ground truth** — manually scored traces become labeled examples for evaluator calibration
- **Fine-tuning** — high-quality traces can seed fine-tuning datasets

## List Your Datasets

Use `foxhound_list_datasets` to see existing datasets:

```
Show me my datasets
```

The response includes dataset IDs, names, trace counts, and creation dates. Use a dataset ID from this list when curating.

`foxhound_list_datasets` takes no parameters.

## Add a Single Trace

Use `foxhound_add_trace_to_dataset` to add one trace to a dataset. This is ideal for traces you've manually reviewed and want to preserve as labeled examples.

```
Add trace abc-123 to dataset ds_helpfulness_golden
```

### Parameters

| Parameter    | Type   | Required | Description |
|--------------|--------|----------|-------------|
| `trace_id`   | string | Yes | The trace to add |
| `dataset_id` | string | Yes | The target dataset |

### Preview / Confirm Pattern

Like all write operations, `foxhound_add_trace_to_dataset` shows a **preview** before writing:

```
Preview: Add trace abc-123 to dataset ds_helpfulness_golden
  trace: abc-123 (billing-bot, 2024-01-15, score: helpfulness=0.92)
  dataset: ds_helpfulness_golden (42 traces currently)
Confirm to proceed.
```

Confirm to add the trace. The `sourceTraceId` field on the dataset entry records which production trace it came from, preserving lineage.

### Lineage Tracking

Every trace added to a dataset has a `sourceTraceId` field. This lets you:
- Trace a dataset entry back to the original production run
- Audit which version of the agent produced the trace
- Reproduce the exact input/output context for debugging

## Bulk Curation by Score Threshold

Use `foxhound_curate_dataset` to add multiple traces at once by filtering on score criteria. This is useful for automatically collecting high-quality examples from recent production traffic.

```
Curate dataset ds_helpfulness_golden: add traces from the last 7 days where helpfulness >= 0.85, limit to 50
```

### Parameters

| Parameter    | Type    | Required | Description |
|--------------|---------|----------|-------------|
| `dataset_id` | string  | Yes | The dataset to curate into |
| `score_name` | string  | No | Score dimension to filter on (e.g. `helpfulness`) |
| `operator`   | string  | No | Comparison operator: `>=`, `<=`, `>`, `<`, `==` |
| `threshold`  | number  | No | Score threshold value (0.0–1.0) |
| `since_days` | number  | No | Only include traces from the last N days |
| `limit`      | number  | No | Maximum traces to add in this curation run |

### Example: Collecting High-Quality Examples

```
# Add traces with helpfulness >= 0.9 from the last 30 days
Curate dataset ds_helpfulness_golden with score_name=helpfulness, operator=>=, threshold=0.9, since_days=30, limit=100
```

### Example: Collecting Failure Cases

```
# Add low-scoring traces to analyze failure patterns
Curate dataset ds_failures with score_name=helpfulness, operator=<=, threshold=0.4, since_days=7, limit=25
```

Having a failure dataset alongside your golden dataset lets you run evaluators on both and verify that your improvements fix failures without regressing on successes.

## Dataset Strategy

A robust evaluation dataset strategy typically combines:

1. **Golden set** — manually curated high-quality traces (50–200 traces). These are your ground truth. Add to this slowly and deliberately.
2. **Regression set** — known failure cases and edge cases (20–50 traces). When you fix a bug, add the failing trace here to prevent recurrence.
3. **Production sample** — recent production traces auto-curated by score threshold (refreshed weekly). This catches distribution drift.

For most teams, starting with 20–30 manually scored golden examples is enough to get useful signal from evaluators and CI gates.

## Viewing Dataset Contents

After curating, view the dataset in the Foxhound dashboard (Datasets → [dataset name]) to see all traces, their scores, and metadata. You can also filter and sort by score dimension, date, and agent name.

## Related

- [Manual Scoring →](./manual-scoring) — score traces before adding them to a dataset
- [LLM-as-a-Judge →](./llm-as-a-judge) — run evaluators against your dataset
- [CI Quality Gates →](./ci-quality-gates) — run quality gates against your dataset automatically
- [MCP Tool Reference →](../mcp-server/tool-reference) — full parameter reference for dataset tools
