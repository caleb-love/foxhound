import { Tracer } from "./tracer.js";
/**
 * Namespaced API for creating and querying scores.
 * Access via `fox.scores.create(...)`.
 */
class ScoresNamespace {
    endpoint;
    apiKey;
    /** @internal */
    constructor(endpoint, apiKey) {
        this.endpoint = endpoint;
        this.apiKey = apiKey;
    }
    headers() {
        return {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
        };
    }
    /**
     * Create a score attached to a trace (and optionally a span).
     */
    async create(params) {
        const body = {
            traceId: params.traceId,
            spanId: params.spanId,
            name: params.name,
            value: params.value,
            label: params.label,
            source: params.source ?? "sdk",
            comment: params.comment,
        };
        const response = await fetch(`${this.endpoint}/v1/scores`, {
            method: "POST",
            headers: this.headers(),
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            const text = await response.text().catch(() => "");
            throw new Error(`Failed to create score: ${response.status} ${text || response.statusText}`);
        }
        return response.json();
    }
}
/**
 * Namespaced API for managing agent cost budgets.
 * Access via `fox.budgets.set(...)`.
 */
class BudgetsNamespace {
    endpoint;
    apiKey;
    /** @internal */
    constructor(endpoint, apiKey) {
        this.endpoint = endpoint;
        this.apiKey = apiKey;
    }
    headers() {
        return {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
        };
    }
    /** Set or update the budget for an agent. */
    async set(params) {
        const { agentId, ...body } = params;
        const response = await fetch(`${this.endpoint}/v1/budgets/${agentId}`, {
            method: "PUT",
            headers: this.headers(),
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            const text = await response.text().catch(() => "");
            throw new Error(`Failed to set budget: ${response.status} ${text || response.statusText}`);
        }
        return response.json();
    }
    /** Get the budget for a specific agent. */
    async get(agentId) {
        const response = await fetch(`${this.endpoint}/v1/budgets/${agentId}`, {
            method: "GET",
            headers: this.headers(),
        });
        if (!response.ok) {
            const text = await response.text().catch(() => "");
            throw new Error(`Failed to get budget: ${response.status} ${text || response.statusText}`);
        }
        return response.json();
    }
    /** List all budgets. */
    async list() {
        const response = await fetch(`${this.endpoint}/v1/budgets`, {
            method: "GET",
            headers: this.headers(),
        });
        if (!response.ok) {
            const text = await response.text().catch(() => "");
            throw new Error(`Failed to list budgets: ${response.status} ${text || response.statusText}`);
        }
        return response.json();
    }
    /** Delete the budget for a specific agent. */
    async delete(agentId) {
        const response = await fetch(`${this.endpoint}/v1/budgets/${agentId}`, {
            method: "DELETE",
            headers: this.headers(),
        });
        if (!response.ok) {
            const text = await response.text().catch(() => "");
            throw new Error(`Failed to delete budget: ${response.status} ${text || response.statusText}`);
        }
    }
}
/**
 * Namespaced API for managing agent SLAs.
 * Access via `fox.slas.set(...)`.
 */
class SLAsNamespace {
    endpoint;
    apiKey;
    /** @internal */
    constructor(endpoint, apiKey) {
        this.endpoint = endpoint;
        this.apiKey = apiKey;
    }
    headers() {
        return {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
        };
    }
    /** Set or update the SLA for an agent. */
    async set(params) {
        const { agentId, ...body } = params;
        const response = await fetch(`${this.endpoint}/v1/slas/${agentId}`, {
            method: "PUT",
            headers: this.headers(),
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            const text = await response.text().catch(() => "");
            throw new Error(`Failed to set SLA: ${response.status} ${text || response.statusText}`);
        }
        return response.json();
    }
    /** Get the SLA for a specific agent. */
    async get(agentId) {
        const response = await fetch(`${this.endpoint}/v1/slas/${agentId}`, {
            method: "GET",
            headers: this.headers(),
        });
        if (!response.ok) {
            const text = await response.text().catch(() => "");
            throw new Error(`Failed to get SLA: ${response.status} ${text || response.statusText}`);
        }
        return response.json();
    }
    /** List all SLAs. */
    async list() {
        const response = await fetch(`${this.endpoint}/v1/slas`, {
            method: "GET",
            headers: this.headers(),
        });
        if (!response.ok) {
            const text = await response.text().catch(() => "");
            throw new Error(`Failed to list SLAs: ${response.status} ${text || response.statusText}`);
        }
        return response.json();
    }
    /** Delete the SLA for a specific agent. */
    async delete(agentId) {
        const response = await fetch(`${this.endpoint}/v1/slas/${agentId}`, {
            method: "DELETE",
            headers: this.headers(),
        });
        if (!response.ok) {
            const text = await response.text().catch(() => "");
            throw new Error(`Failed to delete SLA: ${response.status} ${text || response.statusText}`);
        }
    }
}
/**
 * Namespaced API for regression detection.
 * Access via `fox.regressions.compare(...)`.
 */
class RegressionsNamespace {
    endpoint;
    apiKey;
    /** @internal */
    constructor(endpoint, apiKey) {
        this.endpoint = endpoint;
        this.apiKey = apiKey;
    }
    headers() {
        return {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
        };
    }
    /** Compare two versions of an agent to detect regressions. */
    async compare(params) {
        const { agentId, ...body } = params;
        const response = await fetch(`${this.endpoint}/v1/regressions/${agentId}/compare`, {
            method: "POST",
            headers: this.headers(),
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            const text = await response.text().catch(() => "");
            throw new Error(`Failed to compare regressions: ${response.status} ${text || response.statusText}`);
        }
        return response.json();
    }
    /** Get all baselines for a specific agent. */
    async baselines(agentId) {
        const response = await fetch(`${this.endpoint}/v1/regressions/${agentId}/baselines`, {
            method: "GET",
            headers: this.headers(),
        });
        if (!response.ok) {
            const text = await response.text().catch(() => "");
            throw new Error(`Failed to get baselines: ${response.status} ${text || response.statusText}`);
        }
        return response.json();
    }
    /** Delete a specific baseline version for an agent. */
    async deleteBaseline(params) {
        const { agentId, version } = params;
        const url = new URL(`${this.endpoint}/v1/regressions/${agentId}/baselines`);
        url.searchParams.set("version", version);
        const response = await fetch(url.toString(), {
            method: "DELETE",
            headers: this.headers(),
        });
        if (!response.ok) {
            const text = await response.text().catch(() => "");
            throw new Error(`Failed to delete baseline: ${response.status} ${text || response.statusText}`);
        }
    }
}
/**
 * Namespaced API for datasets (golden test sets).
 * Access via `fox.datasets.create(...)`.
 */
class DatasetsNamespace {
    endpoint;
    apiKey;
    /** @internal */
    constructor(endpoint, apiKey) {
        this.endpoint = endpoint;
        this.apiKey = apiKey;
    }
    headers() {
        return {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
        };
    }
    async request(method, path, body) {
        const response = await fetch(`${this.endpoint}${path}`, {
            method,
            headers: this.headers(),
            ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });
        if (!response.ok) {
            const text = await response.text().catch(() => "");
            throw new Error(`Datasets API error: ${response.status} ${text || response.statusText}`);
        }
        if (response.status === 204)
            return undefined;
        return response.json();
    }
    async create(params) {
        return this.request("POST", "/v1/datasets", params);
    }
    async list() {
        return this.request("GET", "/v1/datasets");
    }
    async get(datasetId) {
        return this.request("GET", `/v1/datasets/${encodeURIComponent(datasetId)}`);
    }
    async delete(datasetId) {
        await this.request("DELETE", `/v1/datasets/${encodeURIComponent(datasetId)}`);
    }
    async addItems(datasetId, items) {
        return this.request("POST", `/v1/datasets/${encodeURIComponent(datasetId)}/items`, { items });
    }
    async fromTraces(datasetId, params) {
        return this.request("POST", `/v1/datasets/${encodeURIComponent(datasetId)}/items/from-traces`, params);
    }
}
/**
 * Namespaced API for experiments (dataset evaluations).
 * Access via `fox.experiments.create(...)`.
 */
class ExperimentsNamespace {
    endpoint;
    apiKey;
    /** @internal */
    constructor(endpoint, apiKey) {
        this.endpoint = endpoint;
        this.apiKey = apiKey;
    }
    headers() {
        return {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
        };
    }
    async request(method, path, body) {
        const response = await fetch(`${this.endpoint}${path}`, {
            method,
            headers: this.headers(),
            ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });
        if (!response.ok) {
            const text = await response.text().catch(() => "");
            throw new Error(`Experiments API error: ${response.status} ${text || response.statusText}`);
        }
        if (response.status === 204)
            return undefined;
        return response.json();
    }
    async create(params) {
        return this.request("POST", "/v1/experiments", params);
    }
    async list(params) {
        const query = new URLSearchParams();
        if (params?.datasetId)
            query.set("datasetId", params.datasetId);
        return this.request("GET", `/v1/experiments?${query.toString()}`);
    }
    async get(experimentId) {
        return this.request("GET", `/v1/experiments/${encodeURIComponent(experimentId)}`);
    }
    async delete(experimentId) {
        await this.request("DELETE", `/v1/experiments/${encodeURIComponent(experimentId)}`);
    }
    async compare(experimentIds) {
        const ids = experimentIds.join(",");
        return this.request("GET", `/v1/experiment-comparisons?experiment_ids=${encodeURIComponent(ids)}`);
    }
}
/**
 * Namespaced API for prompt management.
 * Access via `fox.prompts.get(...)`.
 */
class PromptsNamespace {
    endpoint;
    apiKey;
    cacheTtlMs;
    cache = new Map();
    /** @internal */
    constructor(endpoint, apiKey, cacheTtlMs = 300_000) {
        this.endpoint = endpoint;
        this.apiKey = apiKey;
        this.cacheTtlMs = cacheTtlMs;
    }
    headers() {
        return {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
        };
    }
    cacheKey(name, label) {
        return `${name}::${label}`;
    }
    /**
     * Resolve a prompt by name and label. Results are cached client-side (5min TTL by default).
     *
     * Usage:
     *   const prompt = await fox.prompts.get({ name: "support-agent", label: "production" });
     *   console.log(prompt.content); // The prompt template text
     */
    async get(params) {
        const label = params.label ?? "production";
        const key = this.cacheKey(params.name, label);
        const cached = this.cache.get(key);
        if (cached && cached.expiresAt > Date.now()) {
            return cached.prompt;
        }
        const url = new URL(`${this.endpoint}/v1/prompts/resolve`);
        url.searchParams.set("name", params.name);
        url.searchParams.set("label", label);
        const response = await fetch(url.toString(), {
            method: "GET",
            headers: this.headers(),
        });
        if (!response.ok) {
            const text = await response.text().catch(() => "");
            throw new Error(`Failed to resolve prompt: ${response.status} ${text || response.statusText}`);
        }
        const prompt = (await response.json());
        this.cache.set(key, { prompt, expiresAt: Date.now() + this.cacheTtlMs });
        return prompt;
    }
    /** Invalidate the client-side cache for a specific prompt+label or all prompts. */
    invalidate(params) {
        if (!params) {
            this.cache.clear();
            return;
        }
        const label = params.label ?? "production";
        this.cache.delete(this.cacheKey(params.name, label));
    }
}
export class FoxhoundClient {
    options;
    tracers = new Map();
    /** Namespaced API for scores. */
    scores;
    /** Namespaced API for cost budgets. */
    budgets;
    /** Namespaced API for SLAs. */
    slas;
    /** Namespaced API for regression detection. */
    regressions;
    /** Namespaced API for datasets (golden test sets). */
    datasets;
    /** Namespaced API for experiments (dataset evaluations). */
    experiments;
    /** Namespaced API for prompt management. */
    prompts;
    constructor(options) {
        this.options = {
            flushIntervalMs: 5000,
            maxBatchSize: 100,
            ...options,
        };
        this.scores = new ScoresNamespace(this.options.endpoint, this.options.apiKey);
        this.budgets = new BudgetsNamespace(this.options.endpoint, this.options.apiKey);
        this.slas = new SLAsNamespace(this.options.endpoint, this.options.apiKey);
        this.regressions = new RegressionsNamespace(this.options.endpoint, this.options.apiKey);
        this.datasets = new DatasetsNamespace(this.options.endpoint, this.options.apiKey);
        this.experiments = new ExperimentsNamespace(this.options.endpoint, this.options.apiKey);
        this.prompts = new PromptsNamespace(this.options.endpoint, this.options.apiKey);
    }
    startTrace(params) {
        const tracer = new Tracer({
            agentId: params.agentId,
            sessionId: params.sessionId,
            metadata: {
                ...(params.metadata ?? {}),
                ...(params.parentAgentId ? { parentAgentId: params.parentAgentId } : {}),
                ...(params.correlationId ? { correlationId: params.correlationId } : {}),
            },
            onFlush: (trace) => this.sendTrace(trace),
        });
        this.tracers.set(tracer.traceId, tracer);
        return tracer;
    }
    /**
     * Returns HTTP headers for propagating trace context to downstream agents.
     * Pass these headers when calling other Foxhound-instrumented services.
     */
    getPropagationHeaders(params) {
        const headers = {};
        if (params.correlationId) {
            headers["X-Foxhound-Correlation-Id"] = params.correlationId;
        }
        if (params.parentAgentId) {
            headers["X-Foxhound-Parent-Agent-Id"] = params.parentAgentId;
        }
        return headers;
    }
    async sendTrace(trace) {
        const response = await fetch(`${this.options.endpoint}/v1/traces`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${this.options.apiKey}`,
            },
            body: JSON.stringify(trace),
        });
        if (!response.ok) {
            throw new Error(`Failed to send trace ${trace.id}: ${response.status} ${response.statusText}`);
        }
        this.checkBudgetHeaders(response);
    }
    checkBudgetHeaders(response) {
        if (!this.options.onBudgetExceeded) {
            return;
        }
        const budgetStatus = response.headers?.get("X-Foxhound-Budget-Status");
        if (budgetStatus !== "exceeded") {
            return;
        }
        this.options.onBudgetExceeded({
            agentId: response.headers.get("X-Foxhound-Budget-Agent-Id") ?? "",
            currentCost: parseFloat(response.headers.get("X-Foxhound-Budget-Current-Cost") ?? "0"),
            budgetLimit: parseFloat(response.headers.get("X-Foxhound-Budget-Limit") ?? "0"),
        });
    }
}
//# sourceMappingURL=client.js.map