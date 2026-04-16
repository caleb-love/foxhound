---
title: Manual Scoring
sidebar_label: Manual Scoring
---

# Manual Scoring

Manual scoring is the fastest way to attach quality signal to a trace. You score directly from your IDE using two MCP tools: `foxhound_score_trace` (write a score) and `foxhound_get_trace_scores` (read all scores on a trace).

## When to Use Manual Scoring

- Calibrating your intuition on a new agent before setting up automated evaluators
- Spot-checking production traces that look suspicious
- Adding ground-truth labels to traces you want to add to a dataset
- Overriding or supplementing automated scores with a human verdict

## Score a Trace

Use `foxhound_score_trace` to attach a numeric score on a named dimension:

```
Score trace abc-123 on helpfulness: 0.9 — the agent correctly identified the user's intent and gave a complete answer
```

The MCP server will show you a **preview** of the score before writing it. Confirm to persist.

### Parameters

| Parameter   | Type   | Required | Description                                                 |
| ----------- | ------ | -------- | ----------------------------------------------------------- |
| `trace_id`  | string | Yes      | The trace to score                                          |
| `dimension` | string | Yes      | Scoring dimension, e.g. `helpfulness`, `accuracy`, `safety` |
| `score`     | number | Yes      | Score value, 0.0–1.0 (higher is better)                     |
| `rationale` | string | No       | Explanation for your score — useful for calibration         |

### Score Values

Scores are always in the `0.0–1.0` range. Common conventions:

| Range   | Meaning                                   |
| ------- | ----------------------------------------- |
| 0.9–1.0 | Excellent — meets or exceeds expectations |
| 0.7–0.9 | Good — minor issues only                  |
| 0.5–0.7 | Acceptable — noticeable issues but usable |
| 0.0–0.5 | Poor — significant failure                |

There is no enforced semantic — choose a convention that makes sense for your team and stick with it across dimensions.

### Score Dimensions

A dimension is any string you choose. Common dimensions:

- `helpfulness` — Did the agent give a useful, actionable response?
- `accuracy` — Were factual claims correct?
- `safety` — Did the agent avoid harmful outputs?
- `conciseness` — Was the response appropriately sized?
- `tool_use` — Did the agent call the right tools with correct arguments?

You can score a single trace on multiple dimensions in separate calls.

## Retrieve Scores

Use `foxhound_get_trace_scores` to read all scores attached to a trace:

```
Show me all scores for trace abc-123
```

The response includes scores from all sources — manual scores you added and any automated evaluator scores — grouped by dimension.

### Parameters

| Parameter  | Type   | Required | Description                      |
| ---------- | ------ | -------- | -------------------------------- |
| `trace_id` | string | Yes      | The trace to retrieve scores for |

### Example Response

```
Scores for trace abc-123:
  helpfulness: 0.9 (manual, by you)
  accuracy:    0.85 (evaluator: eval_factcheck_v2, run: run_xyz)
  safety:      1.0 (evaluator: eval_safety_v1, run: run_xyz)
```

## Trace-Level vs Span-Level Scoring

`foxhound_score_trace` attaches the score to the **trace** as a whole. This is appropriate for most use cases where you want an overall quality signal.

If you need to flag a specific part of the agent run, use the span-level context in your rationale field. Span-level scoring UI is available in the Foxhound dashboard.

## Preview / Confirm Pattern

Write operations in the Foxhound MCP server (including `foxhound_score_trace`) use a **preview → confirm** pattern to prevent accidental writes. When you invoke a write tool without the `confirm` flag, the server returns a description of what will be written. Re-run with `confirm=true` (or approve in your IDE's MCP tool prompt) to persist the change.

This pattern means you can safely experiment with score calls in your IDE — nothing is written until you confirm.

## Related

- [MCP Tool Reference →](../mcp-server/tool-reference) — full parameter reference for `foxhound_score_trace` and `foxhound_get_trace_scores`
- [Dataset Curation →](./dataset-curation) — use scored traces to build evaluation datasets
- [LLM-as-a-Judge →](./llm-as-a-judge) — automate scoring at scale
