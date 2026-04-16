/**
 * End-to-end lifecycle tests for the Foxhound API.
 *
 * Builds the full Fastify app with ALL routes registered and exercises
 * cross-route data flows: trace ingestion → query → scoring → evaluator
 * creation → dataset curation → experiment lifecycle.
 *
 * DB is mocked at the module level but mock data flows coherently across
 * endpoints (e.g. a trace created in one test is available for scoring).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { registerAuth } from "./plugins/auth.js";
import type { JwtPayload } from "./plugins/auth.js";

// ── Mock all external modules ──────────────────────────────────────────────

vi.mock("@foxhound/db", () => ({
  // Auth
  resolveApiKey: vi.fn(),
  touchApiKeyLastUsed: vi.fn().mockResolvedValue(undefined),
  // Traces
  insertTrace: vi.fn().mockResolvedValue(undefined),
  insertSpans: vi.fn().mockResolvedValue(undefined),
  queryTraces: vi.fn(),
  countTraces: vi.fn(),
  getTrace: vi.fn(),
  getTraceWithSpans: vi.fn(),
  getReplayContext: vi.fn(),
  diffTraces: vi.fn(),
  updateSpanCosts: vi.fn(),
  // Scores
  createScore: vi.fn(),
  queryScores: vi.fn(),
  countScores: vi.fn(),
  getScoresByTraceId: vi.fn(),
  deleteScore: vi.fn(),
  // Evaluators
  createEvaluator: vi.fn(),
  listEvaluators: vi.fn(),
  getEvaluator: vi.fn(),
  updateEvaluator: vi.fn(),
  deleteEvaluator: vi.fn(),
  createEvaluatorRuns: vi.fn(),
  getEvaluatorRunForOrg: vi.fn(),
  isLlmEvaluationEnabled: vi.fn(),
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
  // Datasets
  createDataset: vi.fn(),
  listDatasets: vi.fn(),
  getDataset: vi.fn(),
  deleteDataset: vi.fn(),
  createDatasetItem: vi.fn(),
  createDatasetItems: vi.fn(),
  listDatasetItems: vi.fn(),
  deleteDatasetItem: vi.fn(),
  countDatasetItems: vi.fn(),
  getTracesForDatasetCuration: vi.fn(),
  // Experiments
  createExperiment: vi.fn(),
  listExperiments: vi.fn(),
  getExperiment: vi.fn(),
  deleteExperiment: vi.fn(),
  createExperimentRuns: vi.fn(),
  listExperimentRuns: vi.fn(),
  getExperimentComparison: vi.fn(),
  // API keys
  createApiKey: vi.fn(),
  listApiKeys: vi.fn(),
  revokeApiKey: vi.fn(),
  generateApiKey: vi.fn(() => ({ key: "sk-abc123", prefix: "sk-abc1", keyHash: "hashval" })),
  // Auth / signup
  signup: vi.fn(),
  createUser: vi.fn(),
  getUserByEmail: vi.fn(),
  getUserById: vi.fn(),
  getMembershipsByUser: vi.fn(),
  getOrganizationById: vi.fn(),
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
  // Billing
  updateOrgPlan: vi.fn(),
  getOrganizationByStripeCustomerId: vi.fn(),
  updateOrgStripeCustomerId: vi.fn(),
  getUsageForPeriod: vi.fn(),
  // Notifications
  createNotificationChannel: vi.fn(),
  listNotificationChannels: vi.fn(),
  getNotificationChannel: vi.fn(),
  deleteNotificationChannel: vi.fn(),
  createNotificationLogEntry: vi.fn(),
  getAlertRulesForOrg: vi.fn().mockResolvedValue([]),
  createAlertRule: vi.fn(),
  listAlertRules: vi.fn(),
  deleteAlertRule: vi.fn(),
  // SSO
  getSsoConfigByOrg: vi.fn(),
  upsertSsoConfig: vi.fn(),
  deleteSsoConfig: vi.fn(),
  updateSsoEnforcement: vi.fn(),
  jitProvisionUser: vi.fn(),
  createSsoSession: vi.fn(),
  deleteSsoSessionsByUser: vi.fn(),
  getOrganizationBySlug: vi.fn(),
  // Waitlist
  insertWaitlistSignup: vi.fn(),
  // Annotations
  createAnnotationQueue: vi.fn(),
  listAnnotationQueues: vi.fn(),
  getAnnotationQueue: vi.fn(),
  getAnnotationQueueStats: vi.fn(),
  deleteAnnotationQueue: vi.fn(),
  addAnnotationQueueItems: vi.fn(),
  claimAnnotationQueueItem: vi.fn(),
  completeAnnotationQueueItem: vi.fn(),
  skipAnnotationQueueItem: vi.fn(),
  getAnnotationQueueItem: vi.fn(),
  // Agent configs (budgets + SLAs share these)
  upsertAgentConfig: vi.fn(),
  getAgentConfig: vi.fn(),
  listAgentConfigs: vi.fn(),
  deleteAgentConfig: vi.fn(),
  // Regressions
  getBaseline: vi.fn(),
  upsertBaseline: vi.fn(),
  getRecentBaselines: vi.fn(),
  deleteBaseline: vi.fn(),
  getSpanStructureForVersion: vi.fn(),
  countTracesForVersion: vi.fn(),
  deleteExpiredTraces: vi.fn(),
}));

vi.mock("@foxhound/billing", () => ({
  getEntitlements: vi.fn().mockResolvedValue({
    evaluators: true,
    customAlerts: true,
    sso: true,
    maxTraceRetentionDays: 90,
    maxEvaluators: 100,
    maxApiKeys: 100,
    annotations: true,
    experiments: true,
    budgets: true,
    slas: true,
    regressions: true,
    datasets: true,
  }),
  invalidateEntitlements: vi.fn(),
  checkSpanLimit: vi.fn().mockResolvedValue({ allowed: true }),
  incrementSpanCount: vi.fn().mockResolvedValue(undefined),
  currentBillingPeriod: vi.fn().mockReturnValue("2026-04"),
  periodBounds: vi.fn().mockReturnValue({ start: new Date(), end: new Date() }),
}));

vi.mock("@foxhound/notifications", () => ({
  dispatchAlert: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./queue.js", () => ({
  getEvaluatorQueue: vi.fn().mockReturnValue(null),
  getExperimentQueue: vi.fn().mockReturnValue(null),
  getCostMonitorQueue: vi.fn().mockReturnValue(null),
  getRegressionDetectorQueue: vi.fn().mockReturnValue(null),
}));

vi.mock("./lib/redis.js", () => ({
  getRedis: vi.fn().mockReturnValue(null),
}));

vi.mock("./lib/config-cache.js", () => ({
  getConfigFromCache: vi.fn().mockResolvedValue(null),
  setCacheEntry: vi.fn(),
  deleteCacheEntry: vi.fn(),
}));

vi.mock("./lib/pricing-cache.js", () => ({
  lookupPricing: vi.fn().mockReturnValue(null),
}));

vi.mock("./jobs/retention-cleanup.js", () => ({
  startRetentionCleanup: vi.fn(),
  stopRetentionCleanup: vi.fn(),
}));

import * as db from "@foxhound/db";

// ── Route imports ──────────────────────────────────────────────────────────

import { tracesRoutes } from "./routes/traces.js";
import { scoresRoutes } from "./routes/scores.js";
import { evaluatorsRoutes } from "./routes/evaluators.js";
import { datasetsRoutes } from "./routes/datasets.js";
import { experimentsRoutes } from "./routes/experiments.js";
import { apiKeysRoutes } from "./routes/apiKeys.js";
import { annotationsRoutes } from "./routes/annotations.js";
import { budgetsRoutes } from "./routes/budgets.js";
import { slasRoutes } from "./routes/slas.js";
import { regressionsRoutes } from "./routes/regressions.js";
import { notificationsRoutes } from "./routes/notifications.js";

// ── Test helpers ───────────────────────────────────────────────────────────

const ORG_ID = "org_e2e";
const USER_ID = "user_e2e";

function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });
  process.env["JWT_SECRET"] = "e2e-test-secret";
  registerAuth(app);
  void app.register(tracesRoutes);
  void app.register(scoresRoutes);
  void app.register(evaluatorsRoutes);
  void app.register(datasetsRoutes);
  void app.register(experimentsRoutes);
  void app.register(apiKeysRoutes);
  void app.register(annotationsRoutes);
  void app.register(budgetsRoutes);
  void app.register(slasRoutes);
  void app.register(regressionsRoutes);
  void app.register(notificationsRoutes);
  return app;
}

function mockApiKey(orgId = ORG_ID) {
  vi.mocked(db.resolveApiKey).mockResolvedValue({
    apiKey: {
      id: "key_e2e",
      orgId,
      keyHash: "hash",
      prefix: "sk-e2e",
      name: "E2E Key",
      createdByUserId: null,
      revokedAt: null,
      expiresAt: null,
      scopes: null,
      lastUsedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    org: {
      id: orgId,
      name: "E2E Org",
      slug: "e2e-org",
      plan: "pro" as const,
      stripeCustomerId: null,
      retentionDays: 90,
      samplingRate: 1.0,
      llmEvaluationEnabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

const AUTH = { authorization: "Bearer sk-e2e-test-key" };

async function getJwt(app: FastifyInstance, payload: JwtPayload): Promise<string> {
  await app.ready();
  return app.jwt.sign(payload);
}

// ── Test suites ────────────────────────────────────────────────────────────

describe("E2E: Full lifecycle flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockApiKey();
  });

  describe("Trace ingestion → query → score → evaluate flow", () => {
    const traceId = "trace_e2e_001";

    function makeMockTrace() {
      const now = new Date();
      return {
        id: traceId,
        orgId: ORG_ID,
        agentId: "agent-1",
        sessionId: "sess-1",
        startTimeMs: now.getTime(),
        endTimeMs: now.getTime() + 5000,
        spans: [] as unknown[],
        metadata: {} as Record<string, unknown>,
        parentAgentId: null,
        correlationId: null,
        createdAt: now,
      };
    }

    function makeMockTraceWithSpans() {
      const base = makeMockTrace();
      return {
        ...base,
        spans: [
          {
            traceId,
            spanId: "span_1",
            name: "llm-call",
            kind: "llm_call" as const,
            startTimeMs: base.startTimeMs,
            endTimeMs: base.startTimeMs + 2000,
            status: "ok" as const,
            attributes: { model: "gpt-4o" } as Record<string, string | number | boolean | null>,
            events: [] as Array<{
              timeMs: number;
              name: string;
              attributes: Record<string, string | number | boolean | null>;
            }>,
          },
        ],
      };
    }

    it("ingests a trace via POST, queries it back, and scores it", async () => {
      const app = buildApp();
      const now = new Date();

      // Step 1: Ingest a trace
      vi.mocked(db.getAlertRulesForOrg).mockResolvedValue([]);

      const ingestRes = await app.inject({
        method: "POST",
        url: "/v1/traces",
        headers: AUTH,
        payload: {
          id: traceId,
          agentId: "agent-1",
          sessionId: "sess-1",
          startTimeMs: now.getTime(),
          spans: [
            {
              traceId,
              spanId: "span_1",
              name: "llm-call",
              kind: "llm_call",
              startTimeMs: now.getTime(),
              endTimeMs: now.getTime() + 2000,
              status: "ok",
              attributes: { model: "gpt-4o" },
              events: [],
            },
          ],
          metadata: {},
        },
      });

      expect(ingestRes.statusCode).toBe(202);
      expect(ingestRes.json().accepted).toBe(true);

      // Step 2: Query traces — should see the trace
      vi.mocked(db.queryTraces).mockResolvedValue([makeMockTrace()]);
      vi.mocked(db.countTraces).mockResolvedValue(1);

      const queryRes = await app.inject({
        method: "GET",
        url: "/v1/traces?agentId=agent-1",
        headers: AUTH,
      });

      expect(queryRes.statusCode).toBe(200);
      const queryBody = queryRes.json();
      expect(queryBody.data).toHaveLength(1);
      expect(queryBody.data[0].agentId).toBe("agent-1");

      // Step 3: Get trace with spans
      vi.mocked(db.getTraceWithSpans).mockResolvedValue(makeMockTraceWithSpans());

      const getRes = await app.inject({
        method: "GET",
        url: `/v1/traces/${traceId}`,
        headers: AUTH,
      });

      expect(getRes.statusCode).toBe(200);
      expect(getRes.json().spans).toHaveLength(1);

      // Step 4: Score the trace
      vi.mocked(db.getTrace).mockResolvedValue(makeMockTrace());
      const mockScore = {
        id: "scr_001",
        orgId: ORG_ID,
        traceId,
        spanId: null,
        name: "quality",
        value: 0.95,
        label: null,
        source: "manual" as const,
        comment: "Excellent response",
        userId: null,
        createdAt: now,
      };
      vi.mocked(db.createScore).mockResolvedValue(mockScore);

      const scoreRes = await app.inject({
        method: "POST",
        url: "/v1/scores",
        headers: AUTH,
        payload: {
          traceId,
          name: "quality",
          value: 0.95,
          source: "manual",
          comment: "Excellent response",
        },
      });

      expect(scoreRes.statusCode).toBe(201);
      expect(scoreRes.json().name).toBe("quality");
      expect(scoreRes.json().value).toBe(0.95);

      // Step 5: Query scores for the trace
      vi.mocked(db.queryScores).mockResolvedValue([mockScore]);
      vi.mocked(db.countScores).mockResolvedValue(1);

      const scoresRes = await app.inject({
        method: "GET",
        url: `/v1/scores?traceId=${traceId}`,
        headers: AUTH,
      });

      expect(scoresRes.statusCode).toBe(200);
      expect(scoresRes.json().data).toHaveLength(1);
      expect(scoresRes.json().data[0].value).toBe(0.95);
    });
  });

  describe("Evaluator lifecycle", () => {
    it("creates an evaluator, lists it, updates it, and deletes it", async () => {
      const app = buildApp();
      const now = new Date();

      const evalData = {
        id: "eval_001",
        orgId: ORG_ID,
        name: "Helpfulness",
        promptTemplate: "Rate how helpful the response is: {{output}}",
        model: "openai:gpt-4o",
        scoringType: "numeric" as const,
        labels: null,
        enabled: true,
        createdAt: now,
      };

      // Create evaluator
      vi.mocked(db.isLlmEvaluationEnabled).mockResolvedValue(true);
      vi.mocked(db.createEvaluator).mockResolvedValue(evalData);

      const createRes = await app.inject({
        method: "POST",
        url: "/v1/evaluators",
        headers: AUTH,
        payload: {
          name: "Helpfulness",
          promptTemplate: "Rate how helpful the response is: {{output}}",
          model: "openai:gpt-4o",
          scoringType: "numeric",
        },
      });

      expect(createRes.statusCode).toBe(201);
      expect(createRes.json().name).toBe("Helpfulness");

      // List evaluators
      vi.mocked(db.listEvaluators).mockResolvedValue([evalData]);

      const listRes = await app.inject({
        method: "GET",
        url: "/v1/evaluators",
        headers: AUTH,
      });

      expect(listRes.statusCode).toBe(200);
      expect(listRes.json().data).toHaveLength(1);

      // Update evaluator
      const updated = { ...evalData, name: "Helpfulness v2" };
      vi.mocked(db.getEvaluator).mockResolvedValue(evalData);
      vi.mocked(db.updateEvaluator).mockResolvedValue(updated);

      const patchRes = await app.inject({
        method: "PATCH",
        url: "/v1/evaluators/eval_001",
        headers: AUTH,
        payload: { name: "Helpfulness v2" },
      });

      expect(patchRes.statusCode).toBe(200);
      expect(patchRes.json().name).toBe("Helpfulness v2");

      // Delete evaluator
      vi.mocked(db.deleteEvaluator).mockResolvedValue(true);

      const deleteRes = await app.inject({
        method: "DELETE",
        url: "/v1/evaluators/eval_001",
        headers: AUTH,
      });

      expect(deleteRes.statusCode).toBe(204);
    });

    it("rejects evaluator run trigger when LLM consent is disabled", async () => {
      const app = buildApp();

      vi.mocked(db.isLlmEvaluationEnabled).mockResolvedValue(false);

      const res = await app.inject({
        method: "POST",
        url: "/v1/evaluator-runs",
        headers: AUTH,
        payload: {
          evaluatorId: "eval_001",
          traceIds: ["trace_e2e_001"],
        },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json().error).toBe("Forbidden");
    });
  });

  describe("Dataset curation → experiment lifecycle", () => {
    it("creates a dataset, adds items, then runs an experiment", async () => {
      const app = buildApp();
      const now = new Date();

      // Step 1: Create a dataset
      const dataset = {
        id: "ds_001",
        orgId: ORG_ID,
        name: "Golden Set",
        description: "Curated traces for regression testing",
        createdAt: now,
      };
      vi.mocked(db.createDataset).mockResolvedValue(dataset);

      const dsRes = await app.inject({
        method: "POST",
        url: "/v1/datasets",
        headers: AUTH,
        payload: { name: "Golden Set", description: "Curated traces for regression testing" },
      });

      expect(dsRes.statusCode).toBe(201);
      expect(dsRes.json().name).toBe("Golden Set");

      // Step 2: Add a single item to the dataset
      const item = {
        id: "dsi_001",
        datasetId: "ds_001",
        input: { query: "What is Foxhound?" },
        expectedOutput: { answer: "An observability platform." },
        metadata: {},
        sourceTraceId: "trace_e2e_001",
        createdAt: now,
      };
      vi.mocked(db.getDataset).mockResolvedValue(dataset);
      vi.mocked(db.createDatasetItem).mockResolvedValue(item);

      const addRes = await app.inject({
        method: "POST",
        url: "/v1/datasets/ds_001/items",
        headers: AUTH,
        payload: {
          input: { query: "What is Foxhound?" },
          expectedOutput: { answer: "An observability platform." },
          sourceTraceId: "trace_e2e_001",
        },
      });

      expect(addRes.statusCode).toBe(201);

      // Step 3: List datasets
      vi.mocked(db.listDatasets).mockResolvedValue([dataset]);

      const listRes = await app.inject({
        method: "GET",
        url: "/v1/datasets",
        headers: AUTH,
      });

      expect(listRes.statusCode).toBe(200);
      expect(listRes.json().data).toHaveLength(1);

      // Step 4: Create experiment referencing the dataset
      vi.mocked(db.getDataset).mockResolvedValue(dataset);
      vi.mocked(db.listDatasetItems).mockResolvedValue([item]);
      const experiment = {
        id: "exp_001",
        orgId: ORG_ID,
        datasetId: "ds_001",
        name: "Baseline v1",
        config: { model: "gpt-4o" },
        status: "pending" as const,
        createdAt: now,
        completedAt: null,
      };
      vi.mocked(db.createExperiment).mockResolvedValue(experiment);
      vi.mocked(db.createExperimentRuns).mockResolvedValue([
        {
          id: "exr_001",
          experimentId: "exp_001",
          datasetItemId: "dsi_001",
          output: null,
          latencyMs: null,
          tokenCount: null,
          cost: null,
          createdAt: now,
        },
      ]);

      const expRes = await app.inject({
        method: "POST",
        url: "/v1/experiments",
        headers: AUTH,
        payload: {
          datasetId: "ds_001",
          name: "Baseline v1",
          config: { model: "gpt-4o" },
        },
      });

      expect(expRes.statusCode).toBe(202);
      expect(expRes.json().experiment.name).toBe("Baseline v1");
      expect(expRes.json().runCount).toBe(1);

      // Step 5: Get experiment with runs
      vi.mocked(db.getExperiment).mockResolvedValue(experiment);
      vi.mocked(db.listExperimentRuns).mockResolvedValue([]);

      const getExpRes = await app.inject({
        method: "GET",
        url: "/v1/experiments/exp_001",
        headers: AUTH,
      });

      expect(getExpRes.statusCode).toBe(200);
      expect(getExpRes.json().name).toBe("Baseline v1");
      expect(getExpRes.json().runs).toEqual([]);

      // Step 6: Delete experiment
      vi.mocked(db.deleteExperiment).mockResolvedValue(true);

      const delExpRes = await app.inject({
        method: "DELETE",
        url: "/v1/experiments/exp_001",
        headers: AUTH,
      });

      expect(delExpRes.statusCode).toBe(204);
    });

    it("rejects experiment on empty dataset", async () => {
      const app = buildApp();
      const now = new Date();

      const dataset = {
        id: "ds_empty",
        orgId: ORG_ID,
        name: "Empty Set",
        description: null,
        createdAt: now,
      };
      vi.mocked(db.getDataset).mockResolvedValue(dataset);
      vi.mocked(db.listDatasetItems).mockResolvedValue([]);

      const res = await app.inject({
        method: "POST",
        url: "/v1/experiments",
        headers: AUTH,
        payload: {
          datasetId: "ds_empty",
          name: "Should Fail",
          config: {},
        },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().error).toContain("no items");
    });
  });

  describe("Cross-org tenant isolation", () => {
    it("cannot score a trace belonging to another org", async () => {
      const app = buildApp();

      // getTrace returns null for wrong org — scoped by org_id
      vi.mocked(db.getTrace).mockResolvedValue(null);

      const res = await app.inject({
        method: "POST",
        url: "/v1/scores",
        headers: AUTH,
        payload: {
          traceId: "trace_other_org",
          name: "quality",
          value: 0.5,
          source: "manual",
        },
      });

      expect(res.statusCode).toBe(404);
      // Verify the route passed the authenticated org's ID to scope the query
      expect(db.getTrace).toHaveBeenCalledWith("trace_other_org", ORG_ID);
    });

    it("cannot create experiment on dataset from another org", async () => {
      const app = buildApp();

      vi.mocked(db.getDataset).mockResolvedValue(null);

      const res = await app.inject({
        method: "POST",
        url: "/v1/experiments",
        headers: AUTH,
        payload: {
          datasetId: "ds_other_org",
          name: "Blocked",
          config: {},
        },
      });

      expect(res.statusCode).toBe(404);
      // Verify the route scoped the dataset lookup by org
      expect(db.getDataset).toHaveBeenCalledWith("ds_other_org", ORG_ID);
    });

    it("cannot access evaluator run from another org", async () => {
      const app = buildApp();

      vi.mocked(db.getEvaluatorRunForOrg).mockResolvedValue(null);

      const res = await app.inject({
        method: "GET",
        url: "/v1/evaluator-runs/run_other_org",
        headers: AUTH,
      });

      expect(res.statusCode).toBe(404);
      // Verify the route used the org-scoped function with the correct org
      expect(db.getEvaluatorRunForOrg).toHaveBeenCalledWith("run_other_org", ORG_ID);
    });
  });

  describe("API key lifecycle (JWT-auth flow)", () => {
    it("creates, lists, and revokes an API key", async () => {
      const app = buildApp();
      const token = await getJwt(app, { userId: USER_ID, orgId: ORG_ID });
      const jwtAuth = { authorization: `Bearer ${token}` };
      const now = new Date();

      // Create API key
      vi.mocked(db.createApiKey).mockResolvedValue({
        id: "key_new",
        orgId: ORG_ID,
        keyHash: "hashval",
        prefix: "sk-abc1",
        name: "CI Key",
        createdByUserId: USER_ID,
        revokedAt: null,
        expiresAt: null,
        scopes: null,
        lastUsedAt: null,
        createdAt: now,
        updatedAt: now,
      });

      const createRes = await app.inject({
        method: "POST",
        url: "/v1/api-keys",
        headers: jwtAuth,
        payload: { name: "CI Key" },
      });

      expect(createRes.statusCode).toBe(201);
      expect(createRes.json().key).toBe("sk-abc123");
      expect(createRes.json().prefix).toBe("sk-abc1");

      // List API keys
      vi.mocked(db.listApiKeys).mockResolvedValue([
        {
          id: "key_new",
          orgId: ORG_ID,
          prefix: "sk-abc1",
          name: "CI Key",
          createdByUserId: USER_ID,
          revokedAt: null,
          expiresAt: null,
          scopes: null,
          lastUsedAt: null,
          createdAt: now,
          isExpired: false,
        },
      ]);

      const listRes = await app.inject({
        method: "GET",
        url: "/v1/api-keys",
        headers: jwtAuth,
      });

      expect(listRes.statusCode).toBe(200);
      expect(listRes.json().data).toHaveLength(1);
      expect(listRes.json().data[0].name).toBe("CI Key");

      // Revoke API key
      vi.mocked(db.revokeApiKey).mockResolvedValue(true);

      const revokeRes = await app.inject({
        method: "DELETE",
        url: "/v1/api-keys/key_new",
        headers: jwtAuth,
      });

      expect(revokeRes.statusCode).toBe(200);
      expect(vi.mocked(db.revokeApiKey)).toHaveBeenCalledWith("key_new", ORG_ID);
    });
  });

  describe("Auth enforcement across all route types", () => {
    it("rejects unauthenticated trace ingestion", async () => {
      const app = buildApp();

      const res = await app.inject({
        method: "POST",
        url: "/v1/traces",
        payload: { id: "trace_noauth", agentId: "agent-1", spans: [], metadata: {} },
      });

      expect(res.statusCode).toBe(401);
    });

    it("rejects unauthenticated score creation", async () => {
      const app = buildApp();

      const res = await app.inject({
        method: "POST",
        url: "/v1/scores",
        payload: { traceId: "trace_1", name: "q", value: 0.5, source: "manual" },
      });

      expect(res.statusCode).toBe(401);
    });

    it("rejects unauthenticated dataset listing", async () => {
      const app = buildApp();

      const res = await app.inject({
        method: "GET",
        url: "/v1/datasets",
      });

      expect(res.statusCode).toBe(401);
    });

    it("rejects unauthenticated evaluator listing", async () => {
      const app = buildApp();

      const res = await app.inject({
        method: "GET",
        url: "/v1/evaluators",
      });

      expect(res.statusCode).toBe(401);
    });

    it("rejects API key route without JWT (API key not accepted)", async () => {
      const app = buildApp();

      const res = await app.inject({
        method: "GET",
        url: "/v1/api-keys",
        headers: AUTH, // API key, not JWT — should fail
      });

      // JWT routes don't accept API keys in the auth flow
      expect(res.statusCode).toBe(401);
    });
  });

  describe("Notification channel → alert rule flow", () => {
    it("creates a channel, creates an alert rule, and lists both", async () => {
      const app = buildApp();
      const now = new Date();

      // Create notification channel
      const channel = {
        id: "ch_001",
        orgId: ORG_ID,
        kind: "slack" as const,
        name: "Ops Slack",
        config: { webhookUrl: "https://hooks.slack.com/test" },
        createdAt: now,
        updatedAt: now,
      };
      vi.mocked(db.createNotificationChannel).mockResolvedValue(channel);

      const chRes = await app.inject({
        method: "POST",
        url: "/v1/notifications/channels",
        headers: AUTH,
        payload: {
          kind: "slack",
          name: "Ops Slack",
          config: { webhookUrl: "https://hooks.slack.com/test" },
        },
      });

      expect(chRes.statusCode).toBe(201);
      expect(chRes.json().name).toBe("Ops Slack");

      // Create alert rule
      const rule = {
        id: "ar_001",
        orgId: ORG_ID,
        eventType: "agent_failure" as const,
        minSeverity: "high" as const,
        channelId: "ch_001",
        enabled: true,
        createdAt: now,
        updatedAt: now,
      };
      vi.mocked(db.getNotificationChannel).mockResolvedValue(channel);
      vi.mocked(db.createAlertRule).mockResolvedValue(rule);

      const arRes = await app.inject({
        method: "POST",
        url: "/v1/notifications/rules",
        headers: AUTH,
        payload: {
          eventType: "agent_failure",
          minSeverity: "high",
          channelId: "ch_001",
        },
      });

      expect(arRes.statusCode).toBe(201);
      expect(arRes.json().eventType).toBe("agent_failure");

      // List channels
      vi.mocked(db.listNotificationChannels).mockResolvedValue([channel]);

      const listChRes = await app.inject({
        method: "GET",
        url: "/v1/notifications/channels",
        headers: AUTH,
      });

      expect(listChRes.statusCode).toBe(200);
      expect(listChRes.json().data).toHaveLength(1);

      // List alert rules
      vi.mocked(db.listAlertRules).mockResolvedValue([rule]);

      const listArRes = await app.inject({
        method: "GET",
        url: "/v1/notifications/rules",
        headers: AUTH,
      });

      expect(listArRes.statusCode).toBe(200);
      expect(listArRes.json().data).toHaveLength(1);
    });
  });

  describe("Budget + SLA monitoring flow", () => {
    it("creates a budget and an SLA target via upsert", async () => {
      const app = buildApp();
      const now = new Date();

      // Create budget via PUT /v1/budgets/:agentId
      const budgetConfig = {
        id: "ac_001",
        orgId: ORG_ID,
        agentId: "agent-1",
        costBudgetUsd: "100.00",
        costAlertThresholdPct: 80,
        budgetPeriod: "monthly" as const,
        maxDurationMs: null,
        minSuccessRate: null,
        evaluationWindowMs: null,
        minSampleSize: null,
        lastCostStatus: null,
        lastSlaStatus: null,
        createdAt: now,
        updatedAt: now,
      };
      vi.mocked(db.getAgentConfig).mockResolvedValue(undefined); // no existing config
      vi.mocked(db.upsertAgentConfig).mockResolvedValue(budgetConfig);

      const bdgRes = await app.inject({
        method: "PUT",
        url: "/v1/budgets/agent-1",
        headers: AUTH,
        payload: {
          costBudgetUsd: 100,
          costAlertThresholdPct: 80,
          budgetPeriod: "monthly",
        },
      });

      expect(bdgRes.statusCode).toBe(201);
      expect(bdgRes.json().agentId).toBe("agent-1");

      // Create SLA target via PUT /v1/slas/:agentId
      const slaConfig = {
        ...budgetConfig,
        maxDurationMs: 5000,
        minSuccessRate: "0.99",
        evaluationWindowMs: 86400000,
        minSampleSize: 10,
      };
      vi.mocked(db.getAgentConfig).mockResolvedValue(undefined);
      vi.mocked(db.upsertAgentConfig).mockResolvedValue(slaConfig);

      const slaRes = await app.inject({
        method: "PUT",
        url: "/v1/slas/agent-1",
        headers: AUTH,
        payload: {
          maxDurationMs: 5000,
          minSuccessRate: 0.99,
          evaluationWindowMs: 86400000,
          minSampleSize: 10,
        },
      });

      expect(slaRes.statusCode).toBe(201);
      expect(slaRes.json().agentId).toBe("agent-1");
    });
  });
});
