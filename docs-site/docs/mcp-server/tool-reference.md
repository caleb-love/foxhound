---
title: MCP Tool Reference
sidebar_label: Tool Reference
---

# MCP Tool Reference

The Foxhound MCP server exposes 30 tools, grouped by capability.

## Trace Querying

### `foxhound_search_traces`

Search traces by agent name, time range, and status. Returns a summary list of matching traces.

**Parameters:**

| Parameter    | Type   | Required | Description                                    |
|--------------|--------|----------|------------------------------------------------|
| `agent_name` | string | No       | Filter by agent ID/name                        |
| `from`       | string | No       | Start time (ISO 8601 or epoch ms)              |
| `to`         | string | No       | End time (ISO 8601 or epoch ms)                |
| `limit`      | number | No       | Max results (default 20, max 100)              |

**Example prompts:**
```
Show me all traces for agent billing-bot in the last hour
Find error traces from the past 24 hours
```

---

### `foxhound_get_trace`

Get the full trace with its complete span tree. Use this to inspect what happened during an agent run.

**Parameters:**

| Parameter  | Type   | Required | Description                |
|------------|--------|----------|----------------------------|
| `trace_id` | string | Yes      | The trace ID to retrieve   |

**Example prompts:**
```
Get trace abc-123 and show me the span tree
What happened in trace def-456?
```

---

### `foxhound_replay_span`

Reconstruct the full agent state at the moment a specific span began — including LLM context, tool inputs, and memory. Requires Pro plan.

**Parameters:**

| Parameter  | Type   | Required | Description                        |
|------------|--------|----------|------------------------------------|
| `trace_id` | string | Yes      | The trace ID containing the span   |
| `span_id`  | string | Yes      | The span ID to replay              |

**Example prompts:**
```
Replay span xyz in trace abc-123 — what was the agent's context?
```

---

### `foxhound_diff_runs`

Compare two agent runs side-by-side and surface divergence points. Useful for debugging regressions. Requires Pro plan.

**Parameters:**

| Parameter    | Type   | Required | Description           |
|--------------|--------|----------|-----------------------|
| `trace_id_a` | string | Yes      | First trace/run ID    |
| `trace_id_b` | string | Yes      | Second trace/run ID   |

**Example prompts:**
```
Compare runs abc and def — why did the second one fail?
```

---

## Analysis

### `foxhound_get_anomalies`

Surface behavioral anomalies in recent traces for an agent — unusually slow spans, error spikes, or unexpected tool usage patterns.

**Parameters:**

| Parameter    | Type   | Required | Description                                    |
|--------------|--------|----------|------------------------------------------------|
| `agent_name` | string | Yes      | Agent ID/name to analyze                       |
| `hours`      | number | No       | Lookback window in hours (default 24, max 168) |

**Example prompts:**
```
Any anomalies for billing-bot in the last 12 hours?
Show me error spikes for the onboarding agent
```

---

### `foxhound_explain_failure`

Analyze a failed trace and produce a human-readable explanation of what went wrong, including the error chain and likely root cause.

**Parameters:**

| Parameter  | Type   | Required | Description                        |
|------------|--------|----------|------------------------------------|
| `trace_id` | string | Yes      | The trace ID of the failed run     |

---

### `foxhound_suggest_fix`

Suggest code-level fixes for a failed trace, based on the error chain and span context.

**Parameters:**

| Parameter  | Type   | Required | Description                        |
|------------|--------|----------|------------------------------------|
| `trace_id` | string | Yes      | The trace ID to suggest fixes for  |

---

## Scoring

### `foxhound_score_trace`

Manually score a trace on one or more dimensions (e.g. helpfulness, accuracy, safety).

**Parameters:**

| Parameter    | Type   | Required | Description                                   |
|--------------|--------|----------|-----------------------------------------------|
| `trace_id`   | string | Yes      | The trace to score                            |
| `dimension`  | string | Yes      | Scoring dimension (e.g. `helpfulness`)        |
| `score`      | number | Yes      | Score value (0.0–1.0)                         |
| `rationale`  | string | No       | Optional explanation for the score            |

---

### `foxhound_get_trace_scores`

Retrieve all scores attached to a trace across all dimensions and evaluators.

**Parameters:**

| Parameter  | Type   | Required | Description              |
|------------|--------|----------|--------------------------|
| `trace_id` | string | Yes      | The trace to retrieve scores for |

---

## Evaluators

### `foxhound_list_evaluators`

List all evaluators configured for your organization.

**Parameters:** None

---

### `foxhound_run_evaluator`

Trigger async evaluator runs for one or more traces. Evaluator runs are async — use `foxhound_get_evaluator_run` to check status and results.

**Parameters:**

| Parameter      | Type     | Required | Description                              |
|----------------|----------|----------|------------------------------------------|
| `evaluator_id` | string   | Yes      | The evaluator to run                     |
| `trace_ids`    | string[] | Yes      | List of trace IDs to evaluate            |

---

### `foxhound_get_evaluator_run`

Check the status and results of an async evaluator run.

**Parameters:**

| Parameter | Type   | Required | Description              |
|-----------|--------|----------|--------------------------|
| `run_id`  | string | Yes      | The evaluator run ID     |

---

## Datasets

### `foxhound_list_datasets`

List all datasets in your organization.

**Parameters:** None

---

### `foxhound_add_trace_to_dataset`

Add a trace to a dataset for evaluation or fine-tuning purposes.

**Parameters:**

| Parameter    | Type   | Required | Description                     |
|--------------|--------|----------|---------------------------------|
| `trace_id`   | string | Yes      | The trace to add                |
| `dataset_id` | string | Yes      | The target dataset              |

---

### `foxhound_curate_dataset`

Curate a dataset by filtering traces based on quality criteria.

**Parameters:**

| Parameter    | Type   | Required | Description                                   |
|--------------|--------|----------|-----------------------------------------------|
| `dataset_id` | string | Yes      | The dataset to curate                         |

---

## Alerts

### `foxhound_list_alert_rules`

List all alert rules configured for your organization.

**Parameters:** None

---

### `foxhound_create_alert_rule`

Create a new alert rule that routes events to a notification channel. This is a write operation.

**Parameters:**

| Parameter      | Type   | Required | Description                                                            |
|----------------|--------|----------|------------------------------------------------------------------------|
| `event_type`   | enum   | Yes      | `agent_failure`, `anomaly_detected`, `cost_spike`, `compliance_violation` |
| `min_severity` | enum   | No       | `critical`, `high`, `medium`, `low` (default: `high`)                 |
| `channel_id`   | string | Yes      | The notification channel ID to route alerts to                         |

---

### `foxhound_delete_alert_rule`

Delete an alert rule by ID. Set `confirm=true` to execute. Without confirmation, returns a preview of what will be deleted.

**Parameters:**

| Parameter | Type    | Required | Description                                        |
|-----------|---------|----------|----------------------------------------------------|
| `rule_id` | string  | Yes      | The alert rule ID to delete                        |
| `confirm` | boolean | No       | Set to `true` to confirm deletion. Omit to preview |

---

### `foxhound_list_channels`

List all notification channels (e.g. Slack webhooks) configured for your organization.

**Parameters:** None

---

### `foxhound_create_channel`

Create a new Slack notification channel. This is a write operation.

**Parameters:**

| Parameter       | Type   | Required | Description                              |
|-----------------|--------|----------|------------------------------------------|
| `name`          | string | Yes      | A human-readable name for the channel    |
| `webhook_url`   | string | Yes      | The Slack incoming webhook URL           |
| `slack_channel` | string | No       | Optional Slack channel override          |

---

### `foxhound_test_channel`

Send a test alert through a notification channel to verify it works.

**Parameters:**

| Parameter    | Type   | Required | Description              |
|--------------|--------|----------|--------------------------|
| `channel_id` | string | Yes      | The channel ID to test   |

---

### `foxhound_delete_channel`

Delete a notification channel by ID. This may also delete associated alert rules. Set `confirm=true` to execute.

**Parameters:**

| Parameter    | Type    | Required | Description                                        |
|--------------|---------|----------|----------------------------------------------------|
| `channel_id` | string  | Yes      | The channel ID to delete                           |
| `confirm`    | boolean | No       | Set to `true` to confirm deletion. Omit to preview |

---

## Keys & Budget

### `foxhound_list_api_keys`

List active API keys for your organization. Keys are masked — only the prefix is shown.

**Parameters:** None

---

### `foxhound_create_api_key`

Create a new API key. For security, the plaintext key is **not** returned through MCP — use the CLI (`foxhound keys create`) or dashboard to retrieve it.

**Parameters:**

| Parameter | Type   | Required | Description                            |
|-----------|--------|----------|----------------------------------------|
| `name`    | string | Yes      | A human-readable name for the key      |

---

### `foxhound_revoke_api_key`

Revoke an API key by ID. The key will immediately stop working. Set `confirm=true` to execute.

**Parameters:**

| Parameter | Type    | Required | Description                                          |
|-----------|---------|----------|------------------------------------------------------|
| `key_id`  | string  | Yes      | The API key ID to revoke                             |
| `confirm` | boolean | No       | Set to `true` to confirm revocation. Omit to preview |

---

### `foxhound_get_agent_budget`

Get the cost budget configuration and current spend status for a specific agent.

**Parameters:**

| Parameter | Type   | Required | Description                          |
|-----------|--------|----------|--------------------------------------|
| `agentId` | string | Yes      | The agent ID to retrieve budget for  |

---

### `foxhound_get_cost_summary`

Get token usage and cost breakdown. Shows current billing period span usage and limits.

**Parameters:** None

---

## SLA & Baselines

### `foxhound_check_sla_status`

Check SLA targets and compliance status for a specific agent, including p95 duration and success rate.

**Parameters:**

| Parameter | Type   | Required | Description                             |
|-----------|--------|----------|-----------------------------------------|
| `agentId` | string | Yes      | The agent ID to check SLA status for    |

---

### `foxhound_detect_regression`

Compare two versions of an agent and detect span-level regressions — missing or newly added spans between versions.

**Parameters:**

| Parameter  | Type   | Required | Description                          |
|------------|--------|----------|--------------------------------------|
| `agentId`  | string | Yes      | The agent ID to analyze              |
| `versionA` | string | Yes      | The baseline version (before)        |
| `versionB` | string | Yes      | The comparison version (after)       |

---

### `foxhound_list_baselines`

List all stored baseline snapshots for an agent, showing version, sample size, and creation date.

**Parameters:**

| Parameter | Type   | Required | Description                              |
|-----------|--------|----------|------------------------------------------|
| `agentId` | string | Yes      | The agent ID to list baselines for       |

---

### `foxhound_status`

Check the health and connectivity of the Foxhound server.

**Parameters:** None

---

## Related

- [MCP Server Setup →](./setup)
