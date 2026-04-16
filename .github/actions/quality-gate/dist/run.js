#!/usr/bin/env node
"use strict";

// ../../../packages/api-client/dist/http.js
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function getBackoffMs(attempt) {
  const base = 500;
  const delay = base * Math.pow(2, attempt) + Math.random() * 200;
  return Math.min(delay, 5e3);
}
function normalizeEndpoint(endpoint) {
  let normalized = endpoint;
  while (normalized.endsWith("/"))
    normalized = normalized.slice(0, -1);
  if (!normalized.startsWith("https://") && !/^http:\/\/(localhost|127\.0\.0\.1)(:|$)/.test(normalized)) {
    throw new Error("Non-localhost endpoints must use HTTPS. Use https:// or connect to localhost for development.");
  }
  return normalized;
}
function createApiHttpClient(config) {
  const endpoint = normalizeEndpoint(config.endpoint);
  const apiKey = config.apiKey;
  const maxRetries = config.maxRetries ?? 2;
  const timeoutMs = config.timeoutMs ?? 3e4;
  function authHeaders(includeJsonContentType = false) {
    return {
      ...includeJsonContentType ? { "Content-Type": "application/json" } : {},
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json"
    };
  }
  async function parseJsonResponse(response, errorPrefix = "Foxhound API") {
    if (!response.ok) {
      const raw = await response.text().catch(() => "");
      const text = raw.length > 500 ? `${raw.slice(0, 500)}\u2026` : raw;
      throw new Error(`${errorPrefix} ${response.status}: ${text || response.statusText}`);
    }
    if (response.status === 204)
      return void 0;
    return response.json();
  }
  async function request(method, path, body, options) {
    const init = {
      method,
      headers: authHeaders(body !== void 0),
      ...body !== void 0 ? { body: JSON.stringify(body) } : {},
      signal: timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : void 0
    };
    let lastError;
    const attempts = maxRetries + 1;
    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const response = await fetch(`${endpoint}${path}`, init);
        if (response.status >= 400 && response.status < 500) {
          return parseJsonResponse(response, options?.errorPrefix ?? "Foxhound API");
        }
        if (response.status >= 500 && attempt < attempts - 1) {
          lastError = new Error(`${options?.errorPrefix ?? "Foxhound API"} ${response.status}`);
          await sleep(getBackoffMs(attempt));
          continue;
        }
        return parseJsonResponse(response, options?.errorPrefix ?? "Foxhound API");
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (lastError.name === "AbortError" || lastError.name === "TimeoutError" || attempt >= attempts - 1) {
          throw lastError;
        }
        await sleep(getBackoffMs(attempt));
      }
    }
    throw lastError ?? new Error("Request failed after retries");
  }
  return {
    endpoint,
    apiKey,
    authHeaders,
    parseJsonResponse,
    request
  };
}

// ../../../packages/api-client/dist/index.js
function appendSegmentationQuery(query, segmentation) {
  if (!segmentation)
    return query;
  if (segmentation.timeRange?.start)
    query.set("start", segmentation.timeRange.start);
  if (segmentation.timeRange?.end)
    query.set("end", segmentation.timeRange.end);
  if (segmentation.status)
    query.set("status", segmentation.status);
  if (segmentation.severity)
    query.set("severity", segmentation.severity);
  if (segmentation.searchQuery)
    query.set("q", segmentation.searchQuery);
  const appendMany = (key, values) => {
    values?.forEach((value) => query.append(key, value));
  };
  appendMany("agentId", segmentation.agentIds);
  appendMany("environmentId", segmentation.environmentIds);
  appendMany("promptId", segmentation.promptIds);
  appendMany("promptVersionId", segmentation.promptVersionIds);
  appendMany("evaluatorId", segmentation.evaluatorIds);
  appendMany("datasetId", segmentation.datasetIds);
  appendMany("modelId", segmentation.modelIds);
  appendMany("toolName", segmentation.toolNames);
  appendMany("tag", segmentation.tags);
  return query;
}
var FoxhoundApiClient = class {
  endpoint;
  apiKey;
  http;
  constructor(config) {
    this.http = createApiHttpClient(config);
    this.endpoint = this.http.endpoint;
    this.apiKey = this.http.apiKey;
  }
  // ── Traces ──────────────────────────────────────────────────────────────
  async searchTraces(params) {
    const query = new URLSearchParams();
    if (params.agentId !== void 0)
      query.set("agentId", params.agentId);
    if (params.from !== void 0)
      query.set("from", String(params.from));
    if (params.to !== void 0)
      query.set("to", String(params.to));
    if (params.limit !== void 0)
      query.set("limit", String(params.limit));
    if (params.page !== void 0)
      query.set("page", String(params.page));
    appendSegmentationQuery(query, params.segmentation);
    return this.get(`/v1/traces?${query.toString()}`);
  }
  async getTrace(traceId) {
    return this.get(`/v1/traces/${encodeURIComponent(traceId)}`);
  }
  async replaySpan(traceId, spanId) {
    return this.get(`/v1/traces/${encodeURIComponent(traceId)}/spans/${encodeURIComponent(spanId)}/replay`);
  }
  async diffRuns(runA, runB) {
    const query = new URLSearchParams({ runA, runB });
    return this.get(`/v1/runs/diff?${query.toString()}`);
  }
  // ── Alert Rules ─────────────────────────────────────────────────────────
  async listAlertRules() {
    return this.get("/v1/notifications/rules");
  }
  async createAlertRule(params) {
    return this.post("/v1/notifications/rules", params);
  }
  async deleteAlertRule(_ruleId) {
    throw new Error("deleteAlertRule is not supported by the current Foxhound API. Remove the rule directly in the dashboard or implement the backend route before using this client method.");
  }
  // ── Notification Channels ─────────────────────────────────────────────
  async listChannels(params) {
    const query = new URLSearchParams();
    appendSegmentationQuery(query, {
      ...params,
      searchQuery: params?.searchQuery
    });
    params?.channelIds?.forEach((channelId) => query.append("channelId", channelId));
    const suffix = query.size > 0 ? `?${query.toString()}` : "";
    return this.get(`/v1/notifications/channels${suffix}`);
  }
  async createChannel(params) {
    return this.post("/v1/notifications/channels", params);
  }
  async testChannel(channelId, params) {
    return this.post("/v1/notifications/test", {
      channelId,
      eventType: params?.eventType ?? "agent_failure",
      severity: params?.severity ?? "high"
    });
  }
  async deleteChannel(_channelId) {
    throw new Error("deleteChannel is not supported by the current Foxhound API. Remove the channel directly in the dashboard or implement the backend route before using this client method.");
  }
  // ── API Keys ──────────────────────────────────────────────────────────
  async listApiKeys() {
    return this.get("/v1/api-keys");
  }
  async createApiKey(name, options) {
    const body = { name };
    if (options?.expiresAt)
      body.expiresAt = options.expiresAt;
    return this.post("/v1/api-keys", body);
  }
  async revokeApiKey(keyId) {
    return this.del(`/v1/api-keys/${encodeURIComponent(keyId)}`);
  }
  // ── Auth ──────────────────────────────────────────────────────────────
  async login(email, password) {
    return this.post("/v1/auth/login", { email, password });
  }
  async getMe() {
    return this.get("/v1/auth/me");
  }
  // ── Health / Usage ────────────────────────────────────────────────────
  async getHealth() {
    return this.get("/health");
  }
  async getUsage() {
    return this.get("/v1/billing/usage");
  }
  // ── Billing ──────────────────────────────────────────────────────────────
  async createCheckout(params) {
    return this.post("/v1/billing/checkout", params);
  }
  async createPortalSession(returnUrl) {
    return this.post("/v1/billing/portal", { returnUrl });
  }
  async getBillingStatus() {
    return this.get("/v1/billing/status");
  }
  // ── Scores ──────────────────────────────────────────────────────────
  async createScore(params) {
    return this.post("/v1/scores", params);
  }
  async queryScores(params) {
    const query = new URLSearchParams();
    if (params?.traceId !== void 0)
      query.set("traceId", params.traceId);
    if (params?.name !== void 0)
      query.set("name", params.name);
    if (params?.source !== void 0)
      query.set("source", params.source);
    if (params?.minValue !== void 0)
      query.set("minValue", String(params.minValue));
    if (params?.maxValue !== void 0)
      query.set("maxValue", String(params.maxValue));
    if (params?.page !== void 0)
      query.set("page", String(params.page));
    if (params?.limit !== void 0)
      query.set("limit", String(params.limit));
    return this.get(`/v1/scores?${query.toString()}`);
  }
  async getTraceScores(traceId) {
    return this.get(`/v1/traces/${encodeURIComponent(traceId)}/scores`);
  }
  async deleteScore(scoreId) {
    await this.del(`/v1/scores/${encodeURIComponent(scoreId)}`);
  }
  // ── Evaluators ─────────────────────────────────────────────────────
  async createEvaluator(params) {
    return this.post("/v1/evaluators", params);
  }
  async listEvaluators(params) {
    const query = new URLSearchParams();
    appendSegmentationQuery(query, {
      ...params,
      searchQuery: params?.searchQuery
    });
    params?.evaluatorIds?.forEach((evaluatorId) => query.append("evaluatorId", evaluatorId));
    const suffix = query.size > 0 ? `?${query.toString()}` : "";
    return this.get(`/v1/evaluators${suffix}`);
  }
  async getEvaluator(evaluatorId) {
    return this.get(`/v1/evaluators/${encodeURIComponent(evaluatorId)}`);
  }
  async deleteEvaluator(evaluatorId) {
    await this.del(`/v1/evaluators/${encodeURIComponent(evaluatorId)}`);
  }
  async triggerEvaluatorRuns(params) {
    return this.post("/v1/evaluator-runs", params);
  }
  async getEvaluatorRun(runId) {
    return this.get(`/v1/evaluator-runs/${encodeURIComponent(runId)}`);
  }
  // ── Annotation Queues ──────────────────────────────────────────────
  async createAnnotationQueue(params) {
    return this.post("/v1/annotation-queues", params);
  }
  async listAnnotationQueues() {
    return this.get("/v1/annotation-queues");
  }
  async getAnnotationQueue(queueId) {
    return this.get(`/v1/annotation-queues/${encodeURIComponent(queueId)}`);
  }
  async deleteAnnotationQueue(queueId) {
    await this.del(`/v1/annotation-queues/${encodeURIComponent(queueId)}`);
  }
  async addAnnotationItems(queueId, traceIds) {
    return this.post(`/v1/annotation-queues/${encodeURIComponent(queueId)}/items`, { traceIds });
  }
  async claimAnnotationItem(queueId) {
    const response = await fetch(`${this.endpoint}/v1/annotation-queues/${encodeURIComponent(queueId)}/claim`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        Accept: "application/json"
      }
    });
    if (response.status === 204)
      return null;
    if (!response.ok) {
      const raw = await response.text().catch(() => "");
      const text = raw.length > 500 ? raw.slice(0, 500) + "\u2026" : raw;
      throw new Error(`Foxhound API ${response.status}: ${text || response.statusText}`);
    }
    return response.json();
  }
  async submitAnnotationItem(itemId, scores) {
    return this.post(`/v1/annotation-queue-items/${encodeURIComponent(itemId)}/submit`, {
      scores
    });
  }
  async skipAnnotationItem(itemId) {
    return this.post(`/v1/annotation-queue-items/${encodeURIComponent(itemId)}/skip`, {});
  }
  // ── Datasets ──────────────────────────────────────────────────────────
  async createDataset(params) {
    return this.post("/v1/datasets", params);
  }
  async listDatasets(params) {
    const query = new URLSearchParams();
    if (params?.page !== void 0)
      query.set("page", String(params.page));
    if (params?.limit !== void 0)
      query.set("limit", String(params.limit));
    appendSegmentationQuery(query, params);
    const suffix = query.size > 0 ? `?${query.toString()}` : "";
    return this.get(`/v1/datasets${suffix}`);
  }
  async getDataset(datasetId) {
    return this.get(`/v1/datasets/${encodeURIComponent(datasetId)}`);
  }
  async deleteDataset(datasetId) {
    await this.del(`/v1/datasets/${encodeURIComponent(datasetId)}`);
  }
  async createDatasetItem(datasetId, params) {
    return this.post(`/v1/datasets/${encodeURIComponent(datasetId)}/items`, params);
  }
  async listDatasetItems(datasetId, params) {
    const query = new URLSearchParams();
    if (params?.page !== void 0)
      query.set("page", String(params.page));
    if (params?.limit !== void 0)
      query.set("limit", String(params.limit));
    return this.get(`/v1/datasets/${encodeURIComponent(datasetId)}/items?${query.toString()}`);
  }
  async deleteDatasetItem(datasetId, itemId) {
    await this.del(`/v1/datasets/${encodeURIComponent(datasetId)}/items/${encodeURIComponent(itemId)}`);
  }
  async createDatasetItemsFromTraces(datasetId, params) {
    return this.post(`/v1/datasets/${encodeURIComponent(datasetId)}/items/from-traces`, params);
  }
  // ── Experiments ────────────────────────────────────────────────────────
  async createExperiment(params) {
    return this.post("/v1/experiments", params);
  }
  async listExperiments(params) {
    const query = new URLSearchParams();
    if (params?.datasetId !== void 0)
      query.set("datasetId", params.datasetId);
    if (params?.page !== void 0)
      query.set("page", String(params.page));
    if (params?.limit !== void 0)
      query.set("limit", String(params.limit));
    appendSegmentationQuery(query, params);
    return this.get(`/v1/experiments?${query.toString()}`);
  }
  async getExperiment(experimentId) {
    return this.get(`/v1/experiments/${encodeURIComponent(experimentId)}`);
  }
  async deleteExperiment(experimentId) {
    await this.del(`/v1/experiments/${encodeURIComponent(experimentId)}`);
  }
  async compareExperiments(experimentIds) {
    const ids = experimentIds.join(",");
    return this.get(`/v1/experiment-comparisons?experiment_ids=${encodeURIComponent(ids)}`);
  }
  // ── Budgets ────────────────────────────────────────────────────────────
  async setBudget(agentId, params) {
    return this.request("PUT", `/v1/budgets/${encodeURIComponent(agentId)}`, params);
  }
  async getBudget(agentId) {
    return this.get(`/v1/budgets/${encodeURIComponent(agentId)}`);
  }
  async listBudgets(params) {
    const qs = new URLSearchParams();
    if (params?.page)
      qs.set("page", String(params.page));
    if (params?.limit)
      qs.set("limit", String(params.limit));
    appendSegmentationQuery(qs, params);
    return this.get(`/v1/budgets?${qs}`);
  }
  async deleteBudget(agentId) {
    await this.del(`/v1/budgets/${encodeURIComponent(agentId)}`);
  }
  // ── SLAs ───────────────────────────────────────────────────────────────
  async setSla(agentId, params) {
    return this.request("PUT", `/v1/slas/${encodeURIComponent(agentId)}`, params);
  }
  async getSla(agentId) {
    return this.get(`/v1/slas/${encodeURIComponent(agentId)}`);
  }
  async listSlas(params) {
    const qs = new URLSearchParams();
    if (params?.page)
      qs.set("page", String(params.page));
    if (params?.limit)
      qs.set("limit", String(params.limit));
    appendSegmentationQuery(qs, params);
    return this.get(`/v1/slas?${qs}`);
  }
  async deleteSla(agentId) {
    await this.del(`/v1/slas/${encodeURIComponent(agentId)}`);
  }
  // ── Regressions ────────────────────────────────────────────────────────
  async getRegression(agentId) {
    return this.get(`/v1/regressions/${encodeURIComponent(agentId)}`);
  }
  async compareVersions(agentId, versionA, versionB) {
    return this.post(`/v1/regressions/${encodeURIComponent(agentId)}/compare`, {
      versionA,
      versionB
    });
  }
  async listBaselines(agentId) {
    return this.get(`/v1/regressions/${encodeURIComponent(agentId)}/baselines`);
  }
  async deleteBaseline(agentId, version) {
    await this.del(`/v1/regressions/${encodeURIComponent(agentId)}/baselines?version=${encodeURIComponent(version)}`);
  }
  // ── Prompts ────────────────────────────────────────────────────────────
  async listPrompts(params) {
    const query = new URLSearchParams();
    if (params?.page !== void 0)
      query.set("page", String(params.page));
    if (params?.limit !== void 0)
      query.set("limit", String(params.limit));
    appendSegmentationQuery(query, params);
    const suffix = query.size > 0 ? `?${query.toString()}` : "";
    return this.get(`/v1/prompts${suffix}`);
  }
  async getPrompt(promptId) {
    return this.get(`/v1/prompts/${encodeURIComponent(promptId)}`);
  }
  async createPrompt(name) {
    return this.post("/v1/prompts", { name });
  }
  async deletePrompt(promptId) {
    await this.del(`/v1/prompts/${encodeURIComponent(promptId)}`);
  }
  async createPromptVersion(promptId, params) {
    return this.post(`/v1/prompts/${encodeURIComponent(promptId)}/versions`, params);
  }
  async listPromptVersions(promptId) {
    return this.get(`/v1/prompts/${encodeURIComponent(promptId)}/versions`);
  }
  async diffPromptVersions(promptId, params) {
    const query = new URLSearchParams({
      versionA: String(params.versionA),
      versionB: String(params.versionB)
    });
    return this.get(`/v1/prompts/${encodeURIComponent(promptId)}/diff?${query.toString()}`);
  }
  async setPromptLabel(promptId, params) {
    return this.post(`/v1/prompts/${encodeURIComponent(promptId)}/labels`, params);
  }
  async deletePromptLabel(promptId, label) {
    await this.del(`/v1/prompts/${encodeURIComponent(promptId)}/labels/${encodeURIComponent(label)}`);
  }
  async resolvePrompt(name, label) {
    const query = new URLSearchParams({ name });
    if (label)
      query.set("label", label);
    return this.get(`/v1/prompts/resolve?${query.toString()}`);
  }
  // ── HTTP helpers ──────────────────────────────────────────────────────
  async get(path) {
    return this.request("GET", path);
  }
  async post(path, body) {
    return this.request("POST", path, body);
  }
  async del(path) {
    return this.request("DELETE", path);
  }
  /**
   * NOTE: Response type T is asserted, not validated at runtime.
   * The API server is the source of truth. If runtime validation
   * is needed, add zod schemas per-endpoint.
   */
  async request(method, path, body) {
    return this.http.request(method, path, body);
  }
};

// run.ts
function getInput(name, required = false) {
  const envKey = `INPUT_${name.toUpperCase().replace(/-/g, "_")}`;
  const value = process.env[envKey] || "";
  if (required && !value) {
    throw new Error(`Missing required input: ${name}`);
  }
  return value;
}
function setOutput(name, value) {
  const outputFile = process.env.GITHUB_OUTPUT;
  if (!outputFile) {
    console.log(`::set-output name=${name}::${value}`);
    return;
  }
  const fs = require("fs");
  fs.appendFileSync(outputFile, `${name}=${value}
`);
}
function appendStepSummary(markdown) {
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryFile) {
    console.log("--- Step Summary ---");
    console.log(markdown);
    return;
  }
  const fs = require("fs");
  fs.appendFileSync(summaryFile, markdown + "\n");
}
async function pollExperiment(client, experimentId, timeoutMs) {
  const startTime = Date.now();
  let delay = 2e3;
  const maxDelay = 3e4;
  let attempt = 0;
  while (true) {
    attempt++;
    const elapsed = Math.round((Date.now() - startTime) / 1e3);
    const experiment = await client.getExperiment(experimentId);
    console.log(`[poll ${attempt}] status=${experiment.status}, elapsed=${elapsed}s`);
    if (experiment.status === "completed") {
      return experiment;
    }
    if (experiment.status === "failed") {
      throw new Error(`Experiment failed: ${experimentId}`);
    }
    if (Date.now() - startTime > timeoutMs) {
      throw new Error(
        `Experiment timed out after ${Math.round(timeoutMs / 1e3)}s, last status: ${experiment.status}`
      );
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
    delay = Math.min(delay * 2, maxDelay);
  }
}
function parseExperimentConfig() {
  const timeoutRaw = getInput("timeout") || "600";
  const timeout = Number(timeoutRaw);
  if (isNaN(timeout) || timeout <= 0) {
    throw new Error(`Invalid timeout value: ${timeoutRaw}`);
  }
  const experimentConfigRaw = getInput("experiment-config", true);
  let config;
  try {
    config = JSON.parse(experimentConfigRaw);
  } catch (err) {
    throw new Error(
      `Invalid experiment-config JSON: ${err instanceof Error ? err.message : String(err)}`
    );
  }
  return { config, timeout };
}
function getExperimentName() {
  const name = getInput("experiment-name");
  if (name) return name;
  const prNumber = process.env.GITHUB_REF?.match(/pull\/(\d+)/)?.[1];
  if (prNumber) return `PR #${prNumber}`;
  return process.env.GITHUB_REF?.replace("refs/heads/", "") || "unknown";
}
async function main() {
  console.log("Starting Foxhound quality gate action...");
  const apiKey = getInput("api-key", true);
  const apiEndpoint = getInput("api-endpoint", true);
  const datasetId = getInput("dataset-id", true);
  const experimentName = getExperimentName();
  const { config, timeout } = parseExperimentConfig();
  console.log(`Dataset ID: ${datasetId}`);
  console.log(`API Endpoint: ${apiEndpoint}`);
  console.log(`Experiment Name: ${experimentName}`);
  console.log(`Timeout: ${timeout}s`);
  const client = new FoxhoundApiClient({
    endpoint: apiEndpoint,
    apiKey
  });
  let experimentId;
  try {
    console.log("Creating experiment...");
    const response = await client.createExperiment({
      datasetId,
      name: experimentName,
      config
    });
    experimentId = response.experiment.id;
    console.log(`Experiment created: ${experimentId}`);
    console.log(`Run count: ${response.runCount}`);
  } catch (err) {
    if (err instanceof Error && err.message.includes("401")) {
      throw new Error("Invalid API key or missing FOXHOUND_API_KEY secret");
    }
    if (err instanceof Error && err.message.includes("403")) {
      throw new Error("Organization lacks 'canEvaluate' entitlement -- upgrade to Pro plan");
    }
    if (err instanceof Error && err.message.includes("404")) {
      throw new Error("Dataset not found -- verify dataset-id input");
    }
    if (err instanceof Error && err.message.includes("500")) {
      throw new Error("Foxhound API server error -- check status.foxhound.dev");
    }
    throw err;
  }
  setOutput("experiment-id", experimentId);
  try {
    console.log(`Polling for experiment completion (timeout: ${timeout}s)...`);
    const experiment = await pollExperiment(client, experimentId, timeout * 1e3);
    console.log(`Experiment completed: ${experiment.id}`);
  } catch (err) {
    if (err instanceof Error) {
      console.error(`Poll failed: ${err.message}`);
    }
    throw err;
  }
  const baselineExperimentId = getInput("baseline-experiment-id") || null;
  const thresholdRaw = getInput("threshold") || "0.0";
  const threshold = Number(thresholdRaw);
  if (isNaN(threshold)) {
    throw new Error(`Invalid threshold value: ${thresholdRaw}`);
  }
  const comparisonUrl = baselineExperimentId ? `https://app.foxhound.dev/experiments/compare?ids=${baselineExperimentId},${experimentId}` : `https://app.foxhound.dev/experiments/${experimentId}`;
  let evaluatorScores = [];
  let violations = [];
  let comparisonError;
  if (baselineExperimentId) {
    console.log(`Comparing with baseline experiment: ${baselineExperimentId}`);
    try {
      const comparison = await client.compareExperiments([baselineExperimentId, experimentId]);
      const scoresByEvaluator = /* @__PURE__ */ new Map();
      for (const score of comparison.scores) {
        if (score.source !== "llm_judge") continue;
        if (score.value === void 0) continue;
        const scoreWithRun = score;
        const run = comparison.runs.find(
          (r) => r.id === scoreWithRun.experimentRunId
        );
        if (!run) continue;
        const isBaseline = run.experimentId === baselineExperimentId;
        const isCurrent = run.experimentId === experimentId;
        if (!isBaseline && !isCurrent) continue;
        if (!scoresByEvaluator.has(score.name)) {
          scoresByEvaluator.set(score.name, { baseline: [], current: [] });
        }
        const bucket = scoresByEvaluator.get(score.name);
        if (isBaseline) bucket.baseline.push(score.value);
        if (isCurrent) bucket.current.push(score.value);
      }
      for (const [name, buckets] of scoresByEvaluator.entries()) {
        const baselineMean = buckets.baseline.length > 0 ? buckets.baseline.reduce((a, b) => a + b, 0) / buckets.baseline.length : 0;
        const currentMean = buckets.current.length > 0 ? buckets.current.reduce((a, b) => a + b, 0) / buckets.current.length : 0;
        const delta = currentMean - baselineMean;
        evaluatorScores.push({ name, baseline: baselineMean, current: currentMean, delta });
        if (currentMean < threshold) {
          violations.push({ name, score: currentMean, threshold });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Failed to compare experiments: ${msg}`);
      comparisonError = `Failed to compare with baseline experiment \`${baselineExperimentId}\`: ${msg}`;
    }
  } else {
    console.log("No baseline provided - posting scores without comparison");
  }
  const passed = violations.length === 0 && !comparisonError;
  const comparisonMarkdown = formatQualityGateComment({
    passed,
    experimentId,
    experimentName,
    baselineExperimentId,
    threshold,
    evaluatorScores,
    comparisonUrl,
    errorMessage: comparisonError
  });
  appendStepSummary(comparisonMarkdown);
  const githubToken = getInput("github-token") || process.env.GITHUB_TOKEN || "";
  const prNumber = getPrNumber();
  const repoInfo = parseRepository();
  if (githubToken && prNumber && repoInfo) {
    try {
      await postOrUpdatePrComment(
        repoInfo.owner,
        repoInfo.repo,
        prNumber,
        comparisonMarkdown,
        githubToken
      );
      console.log(`Posted quality gate comment to PR #${prNumber}`);
    } catch (err) {
      console.error(
        `Failed to post PR comment: ${err instanceof Error ? err.message : String(err)}`
      );
      console.log("Quality gate results written to step summary only");
    }
  } else {
    if (!githubToken) console.log("GITHUB_TOKEN not available - skipping PR comment");
    if (!prNumber) console.log("Not a PR context - skipping PR comment");
    if (!repoInfo) console.log("GITHUB_REPOSITORY not set - skipping PR comment");
  }
  setOutput("comparison-url", comparisonUrl);
  if (violations.length > 0) {
    const names = violations.map((v) => `${v.name} (${v.score.toFixed(3)})`).join(", ");
    console.error(
      `Quality gate failed: ${violations.length} evaluator(s) below threshold ${threshold}: ${names}`
    );
    process.exit(1);
  }
  console.log("Quality gate action complete.");
}
function getPrNumber() {
  const inputPr = process.env.INPUT_PR_NUMBER;
  if (inputPr) {
    const parsed = Number(inputPr);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  const refMatch = process.env.GITHUB_REF?.match(/refs\/pull\/(\d+)\//);
  if (refMatch) return Number(refMatch[1]);
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (eventPath) {
    try {
      const fs = require("fs");
      const event = JSON.parse(fs.readFileSync(eventPath, "utf-8"));
      if (event.pull_request?.number) return event.pull_request.number;
      if (event.issue?.pull_request && event.issue?.number) return event.issue.number;
    } catch {
    }
  }
  return null;
}
function parseRepository() {
  const fullRepo = process.env.GITHUB_REPOSITORY;
  if (!fullRepo) return null;
  const [owner, repo] = fullRepo.split("/");
  if (!owner || !repo) return null;
  return { owner, repo };
}
function formatQualityGateComment(params) {
  const {
    passed,
    experimentId,
    experimentName,
    baselineExperimentId,
    threshold,
    evaluatorScores,
    comparisonUrl,
    errorMessage
  } = params;
  const marker = "<!-- foxhound-quality-gate -->";
  const statusIcon = passed ? "\u2705" : "\u274C";
  const statusText = passed ? "Passed" : "Failed";
  const commitSha = process.env.GITHUB_SHA?.slice(0, 7) || "unknown";
  const timestamp = (/* @__PURE__ */ new Date()).toISOString().replace("T", " ").replace(/\.\d+Z/, " UTC");
  const lines = [marker, ""];
  lines.push(`## ${statusIcon} Foxhound Quality Gate \u2014 ${statusText}`);
  lines.push("");
  if (errorMessage) {
    lines.push(`> **Warning:** ${errorMessage}`);
    lines.push("");
  }
  if (evaluatorScores.length > 0) {
    lines.push(`**Threshold:** \`${threshold.toFixed(3)}\``);
    lines.push("");
    lines.push("| Evaluator | Baseline | Current | Delta | Status |");
    lines.push("|-----------|----------|---------|-------|--------|");
    for (const { name, baseline, current, delta } of evaluatorScores) {
      const deltaStr = delta >= 0 ? `+${delta.toFixed(3)}` : delta.toFixed(3);
      let status;
      if (current < threshold) {
        status = "\u274C below threshold";
      } else if (delta < -1e-3) {
        status = "\u26A0\uFE0F degraded";
      } else if (delta > 1e-3) {
        status = "\u2705 improved";
      } else {
        status = "\u2705 stable";
      }
      lines.push(
        `| ${name} | ${baseline.toFixed(3)} | ${current.toFixed(3)} | ${deltaStr} | ${status} |`
      );
    }
    lines.push("");
  } else if (!errorMessage && baselineExperimentId) {
    lines.push(
      "> No evaluator scores found (all evaluators may be disabled or no LLM judge scores present)"
    );
    lines.push("");
  } else if (!baselineExperimentId) {
    lines.push(
      "> No baseline experiment provided -- this is the first run. Future PRs will show score deltas."
    );
    lines.push("");
  }
  lines.push("<details>");
  lines.push("<summary>Experiment details</summary>");
  lines.push("");
  lines.push("| Field | Value |");
  lines.push("|-------|-------|");
  lines.push(`| Experiment | \`${experimentName}\` |`);
  lines.push(`| Experiment ID | \`${experimentId}\` |`);
  if (baselineExperimentId) {
    lines.push(`| Baseline ID | \`${baselineExperimentId}\` |`);
  }
  lines.push(`| Threshold | \`${threshold.toFixed(3)}\` |`);
  lines.push(`| Commit | \`${commitSha}\` |`);
  lines.push(`| Timestamp | ${timestamp} |`);
  lines.push("");
  lines.push("</details>");
  lines.push("");
  lines.push(`[View full results](${comparisonUrl})`);
  lines.push("");
  return lines.join("\n");
}
async function postOrUpdatePrComment(owner, repo, prNumber, body, githubToken) {
  const marker = "<!-- foxhound-quality-gate -->";
  const markedBody = body.includes(marker) ? body : `${marker}
${body}`;
  const apiBase = process.env.GITHUB_API_URL || "https://api.github.com";
  const commentsUrl = `${apiBase}/repos/${owner}/${repo}/issues/${prNumber}/comments`;
  const headers = {
    Authorization: `token ${githubToken}`,
    Accept: "application/vnd.github.v3+json"
  };
  let existingCommentId = null;
  let page = 1;
  const maxPages = 5;
  while (page <= maxPages) {
    const listRes = await fetch(`${commentsUrl}?per_page=100&page=${page}`, { headers });
    if (!listRes.ok) {
      console.warn(
        `Failed to list PR comments (page ${page}): ${listRes.status} ${listRes.statusText}`
      );
      break;
    }
    const comments = await listRes.json();
    const existing = comments.find((c) => c.body.includes(marker));
    if (existing) {
      existingCommentId = existing.id;
      break;
    }
    if (comments.length < 100) break;
    page++;
  }
  if (existingCommentId !== null) {
    const updateRes = await fetch(
      `${apiBase}/repos/${owner}/${repo}/issues/comments/${existingCommentId}`,
      {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ body: markedBody })
      }
    );
    if (!updateRes.ok) {
      throw new Error(`Failed to update PR comment: ${updateRes.status} ${updateRes.statusText}`);
    }
    return;
  }
  const createRes = await fetch(commentsUrl, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ body: markedBody })
  });
  if (!createRes.ok) {
    throw new Error(`Failed to create PR comment: ${createRes.status} ${createRes.statusText}`);
  }
}
main().catch((err) => {
  console.error("Error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
