---
estimated_steps: 28
estimated_files: 2
skills_used: []
---

# T04: Add dataset tools (list + add_trace + curate)

Wrap existing API client dataset methods with three MCP tools, including a helper function for extracting trace input. These tools advance R010 (datasets auto-curable from production traces).

**Helper function: extractTraceInput(trace: Trace)**
- Extract root span attributes as default input
- Root spans are those with no parentSpanId
- If multiple root spans exist, use the first one
- Convert span.attributes to Record<string, unknown> format expected by DatasetItem
- If no root span exists, use trace metadata as fallback
- Return the extracted input object

**foxhound_list_datasets:**
- No input params required
- Call `api.listDatasets()`
- For each dataset, optionally call `api.getDataset(id)` to get item count (or just list without counts for performance)
- Format as markdown table with columns: ID, Name, Description, Item Count
- Handle empty results ("No datasets found")

**foxhound_add_trace_to_dataset:**
- Input schema: `dataset_id` (string, required), `trace_id` (string, required), `expected_output` (JSON object, optional), `metadata` (JSON object, optional), `confirm` (boolean, optional)
- Preview mode (confirm !== true): Fetch trace, extract input via helper, show formatted preview of what will be added
- Execute mode (confirm === true):
  - Call `api.getTrace(traceId)` to fetch trace
  - Extract input via `extractTraceInput(trace)`
  - Call `api.createDatasetItem(datasetId, { input, expectedOutput, metadata, sourceTraceId: traceId })`
  - Return success message with item ID and dataset ID
- Follow existing confirm pattern

**foxhound_curate_dataset:**
- Input schema: `dataset_id` (string, required), `score_name` (string, required), `operator` (enum: "lt" | "gt" | "lte" | "gte", required), `threshold` (number, required), `since_days` (number, optional), `limit` (number, optional)
- Call `api.createDatasetItemsFromTraces(datasetId, { scoreName, scoreOperator: operator, scoreThreshold: threshold, sinceDays: since_days, limit })`
- Return number of items added with summary message
- Format as: "Added {count} traces to dataset {dataset_id} where score '{score_name}' {operator} {threshold}"

## Inputs

- ``packages/api-client/src/index.ts` — `listDatasets()`, `getDataset()`, `createDatasetItem()`, `createDatasetItemsFromTraces()`, `getTrace()` methods`
- ``packages/types/src/index.ts` — `Dataset`, `DatasetItem`, `Trace`, `Span` interfaces`
- ``packages/mcp-server/src/index.ts` — existing confirm pattern from delete tools`

## Expected Output

- ``packages/mcp-server/src/index.ts` — three new tool registrations: `foxhound_list_datasets`, `foxhound_add_trace_to_dataset`, `foxhound_curate_dataset`, plus helper function `extractTraceInput``
- ``packages/mcp-server/src/api-client.test.ts` — unit tests for dataset tool wrappers and input extraction helper, covering edge cases (no root span, multiple root spans, empty attributes)`

## Verification

pnpm --filter @foxhound-ai/mcp-server test -- --grep "dataset tools"

## Observability Impact

Signals added: MCP tool success messages showing item count added, preview output showing extracted trace input
How a future agent inspects this: Call `foxhound_list_datasets` to see dataset item counts, call `foxhound_add_trace_to_dataset` without confirm to preview extracted input
Failure state exposed: API errors (404 for missing dataset/trace, 400 for invalid score operator/threshold) propagate with status and validation messages
