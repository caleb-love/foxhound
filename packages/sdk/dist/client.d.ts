import type { Score, ScoreSource } from "@foxhound/types";
import { Tracer } from "./tracer.js";
export interface BudgetExceededInfo {
    agentId: string;
    currentCost: number;
    budgetLimit: number;
}
export interface FoxhoundClientOptions {
    apiKey: string;
    endpoint: string;
    flushIntervalMs?: number;
    maxBatchSize?: number;
    onBudgetExceeded?: (info: BudgetExceededInfo) => void;
}
export interface CreateScoreParams {
    traceId: string;
    spanId?: string;
    name: string;
    value?: number;
    label?: string;
    source?: ScoreSource;
    comment?: string;
}
export interface SetBudgetParams {
    agentId: string;
    costBudgetUsd: number;
    costAlertThresholdPct?: number;
    budgetPeriod?: string;
}
export interface SetSLAParams {
    agentId: string;
    maxDurationMs?: number;
    minSuccessRate?: number;
    evaluationWindowMs?: number;
    minSampleSize?: number;
}
export interface CompareRegressionsParams {
    agentId: string;
    versionA: string;
    versionB: string;
}
export interface DeleteBaselineParams {
    agentId: string;
    version: string;
}
/**
 * Namespaced API for creating and querying scores.
 * Access via `fox.scores.create(...)`.
 */
declare class ScoresNamespace {
    private readonly endpoint;
    private readonly apiKey;
    /** @internal */
    constructor(endpoint: string, apiKey: string);
    private headers;
    /**
     * Create a score attached to a trace (and optionally a span).
     */
    create(params: CreateScoreParams): Promise<Score>;
}
/**
 * Namespaced API for managing agent cost budgets.
 * Access via `fox.budgets.set(...)`.
 */
declare class BudgetsNamespace {
    private readonly endpoint;
    private readonly apiKey;
    /** @internal */
    constructor(endpoint: string, apiKey: string);
    private headers;
    /** Set or update the budget for an agent. */
    set(params: SetBudgetParams): Promise<unknown>;
    /** Get the budget for a specific agent. */
    get(agentId: string): Promise<unknown>;
    /** List all budgets. */
    list(): Promise<unknown>;
    /** Delete the budget for a specific agent. */
    delete(agentId: string): Promise<void>;
}
/**
 * Namespaced API for managing agent SLAs.
 * Access via `fox.slas.set(...)`.
 */
declare class SLAsNamespace {
    private readonly endpoint;
    private readonly apiKey;
    /** @internal */
    constructor(endpoint: string, apiKey: string);
    private headers;
    /** Set or update the SLA for an agent. */
    set(params: SetSLAParams): Promise<unknown>;
    /** Get the SLA for a specific agent. */
    get(agentId: string): Promise<unknown>;
    /** List all SLAs. */
    list(): Promise<unknown>;
    /** Delete the SLA for a specific agent. */
    delete(agentId: string): Promise<void>;
}
/**
 * Namespaced API for regression detection.
 * Access via `fox.regressions.compare(...)`.
 */
declare class RegressionsNamespace {
    private readonly endpoint;
    private readonly apiKey;
    /** @internal */
    constructor(endpoint: string, apiKey: string);
    private headers;
    /** Compare two versions of an agent to detect regressions. */
    compare(params: CompareRegressionsParams): Promise<unknown>;
    /** Get all baselines for a specific agent. */
    baselines(agentId: string): Promise<unknown>;
    /** Delete a specific baseline version for an agent. */
    deleteBaseline(params: DeleteBaselineParams): Promise<void>;
}
/**
 * Namespaced API for datasets (golden test sets).
 * Access via `fox.datasets.create(...)`.
 */
declare class DatasetsNamespace {
    private readonly endpoint;
    private readonly apiKey;
    /** @internal */
    constructor(endpoint: string, apiKey: string);
    private headers;
    private request;
    create(params: {
        name: string;
        description?: string;
    }): Promise<unknown>;
    list(): Promise<unknown>;
    get(datasetId: string): Promise<unknown>;
    delete(datasetId: string): Promise<void>;
    addItems(datasetId: string, items: Array<{
        input: Record<string, unknown>;
        expectedOutput?: Record<string, unknown>;
        metadata?: Record<string, unknown>;
    }>): Promise<unknown>;
    fromTraces(datasetId: string, params: {
        traceIds: string[];
        includeOutput?: boolean;
    }): Promise<unknown>;
}
/**
 * Namespaced API for experiments (dataset evaluations).
 * Access via `fox.experiments.create(...)`.
 */
declare class ExperimentsNamespace {
    private readonly endpoint;
    private readonly apiKey;
    /** @internal */
    constructor(endpoint: string, apiKey: string);
    private headers;
    private request;
    create(params: {
        datasetId: string;
        name: string;
        config?: Record<string, unknown>;
    }): Promise<unknown>;
    list(params?: {
        datasetId?: string;
    }): Promise<unknown>;
    get(experimentId: string): Promise<unknown>;
    delete(experimentId: string): Promise<void>;
    compare(experimentIds: string[]): Promise<unknown>;
}
export interface PromptGetParams {
    name: string;
    label?: string;
}
export interface ResolvedPrompt {
    name: string;
    label: string;
    version: number;
    content: string;
    model: string | null;
    config: Record<string, unknown>;
}
/**
 * Namespaced API for prompt management.
 * Access via `fox.prompts.get(...)`.
 */
declare class PromptsNamespace {
    private readonly endpoint;
    private readonly apiKey;
    private readonly cacheTtlMs;
    private readonly cache;
    /** @internal */
    constructor(endpoint: string, apiKey: string, cacheTtlMs?: number);
    private headers;
    private cacheKey;
    /**
     * Resolve a prompt by name and label. Results are cached client-side (5min TTL by default).
     *
     * Usage:
     *   const prompt = await fox.prompts.get({ name: "support-agent", label: "production" });
     *   console.log(prompt.content); // The prompt template text
     */
    get(params: PromptGetParams): Promise<ResolvedPrompt>;
    /** Invalidate the client-side cache for a specific prompt+label or all prompts. */
    invalidate(params?: {
        name: string;
        label?: string;
    }): void;
}
export declare class FoxhoundClient {
    private readonly options;
    private readonly tracers;
    /** Namespaced API for scores. */
    readonly scores: ScoresNamespace;
    /** Namespaced API for cost budgets. */
    readonly budgets: BudgetsNamespace;
    /** Namespaced API for SLAs. */
    readonly slas: SLAsNamespace;
    /** Namespaced API for regression detection. */
    readonly regressions: RegressionsNamespace;
    /** Namespaced API for datasets (golden test sets). */
    readonly datasets: DatasetsNamespace;
    /** Namespaced API for experiments (dataset evaluations). */
    readonly experiments: ExperimentsNamespace;
    /** Namespaced API for prompt management. */
    readonly prompts: PromptsNamespace;
    constructor(options: FoxhoundClientOptions);
    startTrace(params: {
        agentId: string;
        sessionId?: string;
        parentAgentId?: string;
        correlationId?: string;
        metadata?: Record<string, string | number | boolean | null>;
    }): Tracer;
    /**
     * Returns HTTP headers for propagating trace context to downstream agents.
     * Pass these headers when calling other Foxhound-instrumented services.
     */
    getPropagationHeaders(params: {
        correlationId?: string;
        parentAgentId?: string;
    }): Record<string, string>;
    private sendTrace;
    private checkBudgetHeaders;
}
export {};
//# sourceMappingURL=client.d.ts.map