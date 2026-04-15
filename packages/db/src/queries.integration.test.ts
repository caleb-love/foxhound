/**
 * Integration tests for @foxhound/db query functions.
 *
 * Runs against a real PostgreSQL database. Skips automatically
 * when DATABASE_URL is not set (CI must provide it).
 *
 * Multi-tenant org_id isolation is the most critical property
 * being verified here — every list/get/delete query MUST scope by org.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import {
  testDb,
  hasDatabase,
  runMigrations,
  truncateAll,
  closeConnection,
  createTestOrg,
  createTestUser,
  createTestMembership,
  createTestApiKey,
  createTestTrace,
  createTestEvaluator,
  createTestDataset,
  createTestScore,
  createTestAuditLogEntry,
} from "./test-setup.js";

// Dynamically import queries so that DATABASE_URL is read from env at import time.
// We set DATABASE_URL before the dynamic import below.
let queries: typeof import("./queries.js");

describe.skipIf(!hasDatabase)("Database integration tests", () => {
  beforeAll(async () => {
    // Ensure the module-level singleton in client.ts picks up our test URL
    if (!process.env["DATABASE_URL"]) {
      process.env["DATABASE_URL"] = "postgres://foxhound:foxhound@localhost:5432/foxhound_dev";
    }

    await runMigrations();

    // Dynamic import so the module reads DATABASE_URL after we set it
    queries = await import("./queries.js");
  }, 30_000);

  beforeEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await closeConnection();
  });

  // ────────────────────────────────────────────────────────────────────────────
  // org_id isolation — CRITICAL
  // ────────────────────────────────────────────────────────────────────────────

  describe("org_id isolation", () => {
    it("queryTraces returns only traces for the correct org", async () => {
      const orgA = await createTestOrg();
      const orgB = await createTestOrg();

      await createTestTrace(orgA.id, { agentId: "agent-a" });
      await createTestTrace(orgA.id, { agentId: "agent-a" });
      await createTestTrace(orgB.id, { agentId: "agent-b" });

      const tracesA = await queries.queryTraces({ orgId: orgA.id });
      const tracesB = await queries.queryTraces({ orgId: orgB.id });

      expect(tracesA).toHaveLength(2);
      expect(tracesB).toHaveLength(1);
      expect(tracesA.every((t) => t.orgId === orgA.id)).toBe(true);
      expect(tracesB.every((t) => t.orgId === orgB.id)).toBe(true);
    });

    it("getTrace returns null for a trace belonging to a different org", async () => {
      const orgA = await createTestOrg();
      const orgB = await createTestOrg();

      const trace = await createTestTrace(orgA.id);

      const found = await queries.getTrace(trace.id, orgA.id);
      const notFound = await queries.getTrace(trace.id, orgB.id);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(trace.id);
      expect(notFound).toBeNull();
    });

    it("listApiKeys returns only keys for the correct org", async () => {
      const orgA = await createTestOrg();
      const orgB = await createTestOrg();
      const user = await createTestUser();
      await createTestMembership(user.id, orgA.id, "owner");
      await createTestMembership(user.id, orgB.id, "member");

      await createTestApiKey(orgA.id, user.id);
      await createTestApiKey(orgA.id, user.id);
      await createTestApiKey(orgB.id, user.id);

      const keysA = await queries.listApiKeys(orgA.id);
      const keysB = await queries.listApiKeys(orgB.id);

      expect(keysA).toHaveLength(2);
      expect(keysB).toHaveLength(1);
      expect(keysA.every((k) => k.orgId === orgA.id)).toBe(true);
      expect(keysB.every((k) => k.orgId === orgB.id)).toBe(true);
    });

    it("listEvaluators returns only evaluators for the correct org", async () => {
      const orgA = await createTestOrg();
      const orgB = await createTestOrg();

      await createTestEvaluator(orgA.id, { name: "eval-a1" });
      await createTestEvaluator(orgA.id, { name: "eval-a2" });
      await createTestEvaluator(orgB.id, { name: "eval-b1" });

      const evalsA = await queries.listEvaluators(orgA.id);
      const evalsB = await queries.listEvaluators(orgB.id);

      expect(evalsA).toHaveLength(2);
      expect(evalsB).toHaveLength(1);
      expect(evalsA.every((e) => e.orgId === orgA.id)).toBe(true);
    });

    it("deleteEvaluator cannot delete another org's evaluator", async () => {
      const orgA = await createTestOrg();
      const orgB = await createTestOrg();

      const evaluator = await createTestEvaluator(orgA.id);

      // Attempt to delete from orgB — should fail
      const deleted = await queries.deleteEvaluator(evaluator.id, orgB.id);
      expect(deleted).toBe(false);

      // Verify it still exists for orgA
      const stillExists = await queries.getEvaluator(evaluator.id, orgA.id);
      expect(stillExists).not.toBeNull();
    });

    it("getEvaluatorRunForOrg returns null for a run belonging to a different org", async () => {
      const orgA = await createTestOrg();
      const orgB = await createTestOrg();

      const evaluator = await createTestEvaluator(orgA.id);
      const trace = await createTestTrace(orgA.id);

      const run = await queries.createEvaluatorRun({
        id: "run-1",
        evaluatorId: evaluator.id,
        traceId: trace.id,
      });

      const foundForA = await queries.getEvaluatorRunForOrg(run.id, orgA.id);
      const foundForB = await queries.getEvaluatorRunForOrg(run.id, orgB.id);

      expect(foundForA).not.toBeNull();
      expect(foundForA!.id).toBe(run.id);
      expect(foundForB).toBeNull();
    });

    it("listDatasets returns only datasets for the correct org", async () => {
      const orgA = await createTestOrg();
      const orgB = await createTestOrg();

      await createTestDataset(orgA.id, { name: "ds-a" });
      await createTestDataset(orgB.id, { name: "ds-b" });

      const dsA = await queries.listDatasets(orgA.id);
      const dsB = await queries.listDatasets(orgB.id);

      expect(dsA).toHaveLength(1);
      expect(dsB).toHaveLength(1);
      expect(dsA[0]!.orgId).toBe(orgA.id);
      expect(dsB[0]!.orgId).toBe(orgB.id);
    });

    it("getAuditLog returns only audit entries for the correct org", async () => {
      const orgA = await createTestOrg();
      const orgB = await createTestOrg();

      await createTestAuditLogEntry(orgA.id, { action: "api_key.create" });
      await createTestAuditLogEntry(orgA.id, { action: "api_key.revoke" });
      await createTestAuditLogEntry(orgB.id, { action: "evaluator.create" });

      const logA = await queries.getAuditLog(orgA.id);
      const logB = await queries.getAuditLog(orgB.id);

      expect(logA).toHaveLength(2);
      expect(logB).toHaveLength(1);
      expect(logA.every((e) => e.orgId === orgA.id)).toBe(true);
      expect(logB.every((e) => e.orgId === orgB.id)).toBe(true);
    });

    it("queryScores returns only scores for the correct org", async () => {
      const orgA = await createTestOrg();
      const orgB = await createTestOrg();

      const traceA = await createTestTrace(orgA.id);
      const traceB = await createTestTrace(orgB.id);

      await createTestScore(orgA.id, traceA.id, { name: "accuracy" });
      await createTestScore(orgB.id, traceB.id, { name: "accuracy" });

      const scoresA = await queries.queryScores({ orgId: orgA.id });
      const scoresB = await queries.queryScores({ orgId: orgB.id });

      expect(scoresA).toHaveLength(1);
      expect(scoresB).toHaveLength(1);
      expect(scoresA[0]!.orgId).toBe(orgA.id);
    });

    it("revokeApiKey returns false for a key belonging to a different org", async () => {
      const orgA = await createTestOrg();
      const orgB = await createTestOrg();
      const user = await createTestUser();
      await createTestMembership(user.id, orgA.id);

      const key = await createTestApiKey(orgA.id, user.id);

      const revoked = await queries.revokeApiKey(key.id, orgB.id);
      expect(revoked).toBe(false);

      // Key should still be active for orgA
      const keysA = await queries.listApiKeys(orgA.id);
      expect(keysA).toHaveLength(1);
    });

    it("deleteDataset cannot delete another org's dataset", async () => {
      const orgA = await createTestOrg();
      const orgB = await createTestOrg();

      const ds = await createTestDataset(orgA.id);

      const deleted = await queries.deleteDataset(ds.id, orgB.id);
      expect(deleted).toBe(false);

      const stillExists = await queries.getDataset(ds.id, orgA.id);
      expect(stillExists).not.toBeNull();
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // CRUD tests
  // ────────────────────────────────────────────────────────────────────────────

  describe("API key CRUD", () => {
    it("createApiKey + resolveApiKey happy path", async () => {
      const org = await createTestOrg();
      const user = await createTestUser();
      await createTestMembership(user.id, org.id, "owner");

      const generated = queries.generateApiKey();

      await queries.createApiKey({
        id: "key-1",
        orgId: org.id,
        keyHash: generated.keyHash,
        prefix: generated.prefix,
        name: "Production Key",
        createdByUserId: user.id,
      });

      const resolved = await queries.resolveApiKey(generated.key);

      expect(resolved).toBeDefined();
      expect("rejected" in resolved).toBe(false);
      if (!("rejected" in resolved)) {
        expect(resolved.apiKey.id).toBe("key-1");
        expect(resolved.org.id).toBe(org.id);
      }
    });

    it("resolveApiKey rejects expired keys", async () => {
      const org = await createTestOrg();
      const user = await createTestUser();
      await createTestMembership(user.id, org.id, "owner");

      const generated = queries.generateApiKey();
      const pastDate = new Date(Date.now() - 86400_000); // 1 day ago

      await queries.createApiKey({
        id: "key-expired",
        orgId: org.id,
        keyHash: generated.keyHash,
        prefix: generated.prefix,
        name: "Expired Key",
        createdByUserId: user.id,
        expiresAt: pastDate,
      });

      const resolved = await queries.resolveApiKey(generated.key);
      expect(resolved).toEqual({ rejected: "expired" });
    });

    it("resolveApiKey rejects revoked keys", async () => {
      const org = await createTestOrg();
      const user = await createTestUser();
      await createTestMembership(user.id, org.id, "owner");

      const key = await createTestApiKey(org.id, user.id);

      // Revoke it
      const revoked = await queries.revokeApiKey(key.id, org.id);
      expect(revoked).toBe(true);

      // Attempt to resolve
      const resolved = await queries.resolveApiKey(key.rawKey);
      expect(resolved).toEqual({ rejected: "revoked" });
    });

    it("resolveApiKey returns not_found for unknown keys", async () => {
      const resolved = await queries.resolveApiKey(`sk-${"a".repeat(64)}`);
      expect(resolved).toEqual({ rejected: "not_found" });
    });

    it("listApiKeys excludes revoked keys but keeps expired keys marked as expired", async () => {
      const org = await createTestOrg();
      const user = await createTestUser();
      await createTestMembership(user.id, org.id, "owner");

      const active = await createTestApiKey(org.id, user.id, { name: "active-key" });
      const expired = await createTestApiKey(org.id, user.id, {
        name: "expired-key",
        expiresAt: new Date(Date.now() - 60_000),
      });
      const revoked = await createTestApiKey(org.id, user.id, {
        name: "revoked-key",
        revokedAt: new Date(),
      });

      const keys = await queries.listApiKeys(org.id);
      expect(keys).toHaveLength(2);
      expect(keys.some((k) => k.id === active.id && k.isExpired === false)).toBe(true);
      expect(keys.some((k) => k.id === expired.id && k.isExpired === true)).toBe(true);
      expect(keys.some((k) => k.id === revoked.id)).toBe(false);
    });

    it("touchApiKeyLastUsed updates lastUsedAt for active keys", async () => {
      const org = await createTestOrg();
      const user = await createTestUser();
      await createTestMembership(user.id, org.id, "owner");

      const key = await createTestApiKey(org.id, user.id);
      await queries.touchApiKeyLastUsed(key.id);

      const keys = await queries.listApiKeys(org.id);
      const found = keys.find((k) => k.id === key.id);
      expect(found).toBeDefined();
      expect(found!.lastUsedAt).not.toBeNull();
    });

    it("revokeApiKey returns false for wrong org", async () => {
      const orgA = await createTestOrg();
      const orgB = await createTestOrg();
      const user = await createTestUser();
      await createTestMembership(user.id, orgA.id);

      const key = await createTestApiKey(orgA.id, user.id);

      expect(await queries.revokeApiKey(key.id, orgB.id)).toBe(false);
      // Still active
      expect(await queries.revokeApiKey(key.id, orgA.id)).toBe(true);
    });
  });

  describe("Trace CRUD", () => {
    it("insertTrace + queryTraces round trip", async () => {
      const org = await createTestOrg();

      const trace = {
        id: "trace-roundtrip",
        agentId: "my-agent",
        sessionId: "session-1",
        startTimeMs: Date.now(),
        spans: [],
        metadata: { environment: "test" },
      };

      await queries.insertTrace(trace as any, org.id);

      const results = await queries.queryTraces({ orgId: org.id });
      expect(results).toHaveLength(1);
      expect(results[0]!.id).toBe("trace-roundtrip");
      expect(results[0]!.agentId).toBe("my-agent");
      expect(results[0]!.metadata).toEqual({ environment: "test" });
    });

    it("queryTraces respects agentId filter", async () => {
      const org = await createTestOrg();

      await createTestTrace(org.id, { agentId: "agent-x" });
      await createTestTrace(org.id, { agentId: "agent-y" });
      await createTestTrace(org.id, { agentId: "agent-x" });

      const filtered = await queries.queryTraces({
        orgId: org.id,
        agentId: "agent-x",
      });

      expect(filtered).toHaveLength(2);
      expect(filtered.every((t) => t.agentId === "agent-x")).toBe(true);
    });

    it("queryTraces respects time range filters", async () => {
      const org = await createTestOrg();
      const now = Date.now();

      await createTestTrace(org.id, { startTimeMs: now - 5000 });
      await createTestTrace(org.id, { startTimeMs: now });
      await createTestTrace(org.id, { startTimeMs: now + 5000 });

      const filtered = await queries.queryTraces({
        orgId: org.id,
        from: now - 1000,
        to: now + 1000,
      });

      expect(filtered).toHaveLength(1);
    });
  });

  describe("Score CRUD", () => {
    it("createScore + queryScores round trip", async () => {
      const org = await createTestOrg();
      const trace = await createTestTrace(org.id);

      const score = await queries.createScore({
        id: "score-1",
        orgId: org.id,
        traceId: trace.id,
        name: "helpfulness",
        value: 0.95,
        source: "sdk",
      });

      expect(score.id).toBe("score-1");
      expect(score.value).toBeCloseTo(0.95);

      const results = await queries.queryScores({ orgId: org.id });
      expect(results).toHaveLength(1);
      expect(results[0]!.name).toBe("helpfulness");
    });

    it("queryScores filters by name and source", async () => {
      const org = await createTestOrg();
      const trace = await createTestTrace(org.id);

      await queries.createScore({
        id: "s1",
        orgId: org.id,
        traceId: trace.id,
        name: "accuracy",
        value: 0.9,
        source: "sdk",
      });
      await queries.createScore({
        id: "s2",
        orgId: org.id,
        traceId: trace.id,
        name: "helpfulness",
        value: 0.8,
        source: "manual",
      });

      const byName = await queries.queryScores({
        orgId: org.id,
        name: "accuracy",
      });
      expect(byName).toHaveLength(1);

      const bySource = await queries.queryScores({
        orgId: org.id,
        source: "manual",
      });
      expect(bySource).toHaveLength(1);
    });
  });

  describe("Evaluator CRUD", () => {
    it("createEvaluator + getEvaluator + updateEvaluator", async () => {
      const org = await createTestOrg();

      const evaluator = await queries.createEvaluator({
        id: "eval-1",
        orgId: org.id,
        name: "Quality Check",
        promptTemplate: "Rate the {{output}}",
        model: "gpt-4o",
        scoringType: "numeric",
      });

      expect(evaluator.name).toBe("Quality Check");

      const found = await queries.getEvaluator("eval-1", org.id);
      expect(found).not.toBeNull();
      expect(found!.model).toBe("gpt-4o");

      const updated = await queries.updateEvaluator("eval-1", org.id, {
        name: "Updated Quality Check",
        model: "claude-sonnet-4-20250514",
      });

      expect(updated).not.toBeNull();
      expect(updated!.name).toBe("Updated Quality Check");
      expect(updated!.model).toBe("claude-sonnet-4-20250514");
    });

    it("deleteEvaluator removes the evaluator", async () => {
      const org = await createTestOrg();

      const evaluator = await queries.createEvaluator({
        id: "eval-to-delete",
        orgId: org.id,
        name: "Temp Eval",
        promptTemplate: "template",
        model: "gpt-4o",
        scoringType: "numeric",
      });

      const deleted = await queries.deleteEvaluator(evaluator.id, org.id);
      expect(deleted).toBe(true);

      const found = await queries.getEvaluator(evaluator.id, org.id);
      expect(found).toBeNull();
    });
  });

  describe("Dataset CRUD", () => {
    it("createDataset + listDatasets + getDataset", async () => {
      const org = await createTestOrg();

      const ds = await queries.createDataset({
        id: "ds-1",
        orgId: org.id,
        name: "Training Set",
        description: "Test dataset for integration tests",
      });

      expect(ds.name).toBe("Training Set");

      const list = await queries.listDatasets(org.id);
      expect(list).toHaveLength(1);

      const found = await queries.getDataset("ds-1", org.id);
      expect(found).not.toBeNull();
      expect(found!.description).toBe("Test dataset for integration tests");
    });

    it("deleteDataset removes the dataset", async () => {
      const org = await createTestOrg();
      const ds = await createTestDataset(org.id);

      const deleted = await queries.deleteDataset(ds.id, org.id);
      expect(deleted).toBe(true);

      const found = await queries.getDataset(ds.id, org.id);
      expect(found).toBeNull();
    });
  });

  describe("Audit log", () => {
    it("writeAuditLog + getAuditLog round trip", async () => {
      const org = await createTestOrg();
      const user = await createTestUser();
      await createTestMembership(user.id, org.id, "owner");

      await queries.writeAuditLog({
        orgId: org.id,
        actorUserId: user.id,
        action: "api_key.create",
        targetType: "api_key",
        targetId: "key-123",
        metadata: { keyName: "Production" },
        ipAddress: "127.0.0.1",
      });

      const log = await queries.getAuditLog(org.id);
      expect(log).toHaveLength(1);
      expect(log[0]!.action).toBe("api_key.create");
      expect(log[0]!.targetType).toBe("api_key");
      expect(log[0]!.actorUserId).toBe(user.id);
    });

    it("getAuditLog respects limit cap (max 500)", async () => {
      const org = await createTestOrg();

      // Request limit above 500 — should be capped at 500
      const log = await queries.getAuditLog(org.id, { limit: 999 });
      // With empty data, just verify the query ran without error
      expect(log).toHaveLength(0);

      // Verify the internal cap works by checking with a small dataset
      for (let i = 0; i < 5; i++) {
        await createTestAuditLogEntry(org.id, {
          action: `action-${i}`,
        });
      }

      const limited = await queries.getAuditLog(org.id, { limit: 3 });
      expect(limited).toHaveLength(3);

      // Even if limit is 9999, the code caps at 500 — with 5 entries we get 5
      const capped = await queries.getAuditLog(org.id, { limit: 9999 });
      expect(capped).toHaveLength(5);
    });
  });

  describe("isLlmEvaluationEnabled", () => {
    it("returns false by default", async () => {
      const org = await createTestOrg();
      const enabled = await queries.isLlmEvaluationEnabled(org.id);
      expect(enabled).toBe(false);
    });

    it("returns true after being enabled", async () => {
      const org = await createTestOrg({ llmEvaluationEnabled: true });
      const enabled = await queries.isLlmEvaluationEnabled(org.id);
      expect(enabled).toBe(true);
    });

    it("returns false for non-existent org", async () => {
      const enabled = await queries.isLlmEvaluationEnabled("non-existent-org");
      expect(enabled).toBe(false);
    });
  });

  describe("touchApiKeyLastUsed", () => {
    it("writes lastUsedAt when null", async () => {
      const org = await createTestOrg();
      const user = await createTestUser();
      await createTestMembership(user.id, org.id);
      const key = await createTestApiKey(org.id, user.id);

      await queries.touchApiKeyLastUsed(key.id);

      const resolved = await queries.resolveApiKey(key.rawKey);
      expect("rejected" in resolved).toBe(false);
      if (!("rejected" in resolved)) {
        expect(resolved.apiKey.lastUsedAt).not.toBeNull();
      }
    });

    it("skips write within 60-second debounce window", async () => {
      const org = await createTestOrg();
      const user = await createTestUser();
      await createTestMembership(user.id, org.id);
      const key = await createTestApiKey(org.id, user.id);

      // First touch — should write
      await queries.touchApiKeyLastUsed(key.id);

      const afterFirst = await queries.resolveApiKey(key.rawKey);
      expect("rejected" in afterFirst).toBe(false);
      if ("rejected" in afterFirst) throw new Error("unexpected rejection");
      const firstTimestamp = afterFirst.apiKey.lastUsedAt;
      expect(firstTimestamp).not.toBeNull();

      // Second touch — within 60s window, should NOT update the timestamp
      // (The SQL condition checks lastUsedAt < now() - 60s, so a recent timestamp blocks the write)
      await queries.touchApiKeyLastUsed(key.id);

      const afterSecond = await queries.resolveApiKey(key.rawKey);
      if ("rejected" in afterSecond) throw new Error("unexpected rejection");
      // Timestamp should be unchanged since the debounce prevents writing
      expect(afterSecond.apiKey.lastUsedAt!.getTime()).toBe(firstTimestamp!.getTime());
    });
  });

  describe("deleteExpiredTraces", () => {
    it("deletes traces older than retention cutoff", async () => {
      const org = await createTestOrg({ retentionDays: 30 });

      // Create an old trace (45 days ago)
      const oldDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);
      await testDb.insert((await import("./schema.js")).traces).values({
        id: "old-trace",
        orgId: org.id,
        agentId: "agent",
        startTimeMs: oldDate.getTime(),
        spans: [],
        metadata: {},
        createdAt: oldDate,
      });

      // Create a recent trace
      await createTestTrace(org.id, { id: "new-trace" });

      const deletedCount = await queries.deleteExpiredTraces(org.id, 30);
      expect(deletedCount).toBe(1);

      const remaining = await queries.queryTraces({ orgId: org.id });
      expect(remaining).toHaveLength(1);
      expect(remaining[0]!.id).toBe("new-trace");
    });

    it("returns 0 when no traces are expired", async () => {
      const org = await createTestOrg();
      await createTestTrace(org.id);

      const deleted = await queries.deleteExpiredTraces(org.id, 90);
      expect(deleted).toBe(0);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Edge cases
  // ────────────────────────────────────────────────────────────────────────────

  describe("Edge cases", () => {
    it("empty org has zero results for all list queries", async () => {
      const org = await createTestOrg();

      const traces = await queries.queryTraces({ orgId: org.id });
      expect(traces).toHaveLength(0);

      const apiKeysList = await queries.listApiKeys(org.id);
      expect(apiKeysList).toHaveLength(0);

      const evaluatorsList = await queries.listEvaluators(org.id);
      expect(evaluatorsList).toHaveLength(0);

      const datasetsList = await queries.listDatasets(org.id);
      expect(datasetsList).toHaveLength(0);

      const auditLog = await queries.getAuditLog(org.id);
      expect(auditLog).toHaveLength(0);

      const scoresList = await queries.queryScores({ orgId: org.id });
      expect(scoresList).toHaveLength(0);
    });

    it("getTrace returns null for non-existent trace", async () => {
      const org = await createTestOrg();
      const result = await queries.getTrace("non-existent", org.id);
      expect(result).toBeNull();
    });

    it("getEvaluator returns null for non-existent evaluator", async () => {
      const org = await createTestOrg();
      const result = await queries.getEvaluator("non-existent", org.id);
      expect(result).toBeNull();
    });

    it("getDataset returns null for non-existent dataset", async () => {
      const org = await createTestOrg();
      const result = await queries.getDataset("non-existent", org.id);
      expect(result).toBeNull();
    });

    it("resolveApiKey returns not_found rejection for non-existent key", async () => {
      const result = await queries.resolveApiKey("sk-nonexistentkey");
      expect(result).toEqual({ rejected: "not_found" });
    });

    it("deleteEvaluator returns false for non-existent evaluator", async () => {
      const org = await createTestOrg();
      const result = await queries.deleteEvaluator("non-existent", org.id);
      expect(result).toBe(false);
    });

    it("deleteDataset returns false for non-existent dataset", async () => {
      const org = await createTestOrg();
      const result = await queries.deleteDataset("non-existent", org.id);
      expect(result).toBe(false);
    });

    it("revokeApiKey returns false for non-existent key", async () => {
      const org = await createTestOrg();
      const result = await queries.revokeApiKey("non-existent", org.id);
      expect(result).toBe(false);
    });

    it("insertTrace is idempotent (onConflictDoNothing)", async () => {
      const org = await createTestOrg();

      const trace = {
        id: "idempotent-trace",
        agentId: "agent",
        startTimeMs: Date.now(),
        spans: [],
        metadata: {},
      };

      await queries.insertTrace(trace as any, org.id);
      // Second insert should not throw
      await queries.insertTrace(trace as any, org.id);

      const results = await queries.queryTraces({ orgId: org.id });
      expect(results).toHaveLength(1);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Organization queries
  // ────────────────────────────────────────────────────────────────────────────

  describe("Organization queries", () => {
    it("getOrganizationById returns the org", async () => {
      const org = await createTestOrg();
      const found = await queries.getOrganizationById(org.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(org.id);
      expect(found!.name).toBe(org.name);
    });

    it("getOrganizationBySlug returns the org", async () => {
      const org = await createTestOrg();
      const found = await queries.getOrganizationBySlug(org.slug);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(org.id);
    });

    it("updateOrgPlan updates and returns the org", async () => {
      const org = await createTestOrg();
      const updated = await queries.updateOrgPlan(org.id, "pro");
      expect(updated).not.toBeNull();
      expect(updated!.plan).toBe("pro");
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Signup / membership
  // ────────────────────────────────────────────────────────────────────────────

  describe("Signup", () => {
    it("signup creates org + user + membership atomically", async () => {
      const result = await queries.signup({
        userId: "signup-user",
        orgId: "signup-org",
        orgName: "Startup Inc",
        orgSlug: "startup-inc",
        email: "founder@startup.com",
        passwordHash: "hash:value",
        name: "Founder",
      });

      expect(result.org.id).toBe("signup-org");
      expect(result.user.id).toBe("signup-user");

      const membershipsResult = await queries.getMembershipsByUser("signup-user");
      expect(membershipsResult).toHaveLength(1);
      expect(membershipsResult[0]!.role).toBe("owner");
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Annotation queue
  // ────────────────────────────────────────────────────────────────────────────

  describe("Annotation queue", () => {
    it("createAnnotationQueue + listAnnotationQueues", async () => {
      const org = await createTestOrg();

      const queue = await queries.createAnnotationQueue({
        id: "queue-1",
        orgId: org.id,
        name: "Review Queue",
        scoreConfigs: [{ name: "quality", type: "numeric" }],
      });

      expect(queue.name).toBe("Review Queue");

      const list = await queries.listAnnotationQueues(org.id);
      expect(list).toHaveLength(1);
    });

    it("queue item lifecycle stays org-scoped", async () => {
      const orgA = await createTestOrg();
      const orgB = await createTestOrg();
      const user = await createTestUser();
      const trace = await createTestTrace(orgA.id);

      await queries.createAnnotationQueue({
        id: "queue-lifecycle",
        orgId: orgA.id,
        name: "Lifecycle Queue",
      });

      const items = await queries.addAnnotationQueueItems(
        { queueId: "queue-lifecycle", traceIds: [trace.id] },
        () => "aqi-1",
      );
      expect(items).toHaveLength(1);

      const claimed = await queries.claimAnnotationQueueItem("queue-lifecycle", orgA.id, user.id);
      expect(claimed).not.toBeNull();
      expect(claimed!.assignedTo).toBe(user.id);

      const blocked = await queries.completeAnnotationQueueItem(claimed!.id, orgB.id);
      expect(blocked).toBeNull();

      const completed = await queries.completeAnnotationQueueItem(claimed!.id, orgA.id);
      expect(completed).not.toBeNull();
      expect(completed!.status).toBe("completed");

      const fetched = await queries.getAnnotationQueueItem(claimed!.id, orgA.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.status).toBe("completed");
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Notification channels
  // ────────────────────────────────────────────────────────────────────────────

  describe("Notification channels", () => {
    it("createNotificationChannel + listNotificationChannels", async () => {
      const org = await createTestOrg();

      const channel = await queries.createNotificationChannel({
        id: "ch-1",
        orgId: org.id,
        kind: "slack",
        name: "#alerts",
        config: { webhookUrl: "https://hooks.slack.com/test" },
      });

      expect(channel.name).toBe("#alerts");

      const list = await queries.listNotificationChannels(org.id);
      expect(list).toHaveLength(1);
      expect(list[0]!.kind).toBe("slack");
    });

    it("notification channels are org-scoped", async () => {
      const orgA = await createTestOrg();
      const orgB = await createTestOrg();

      await queries.createNotificationChannel({
        id: "ch-a",
        orgId: orgA.id,
        kind: "slack",
        name: "#orgA-alerts",
        config: {},
      });

      const listA = await queries.listNotificationChannels(orgA.id);
      const listB = await queries.listNotificationChannels(orgB.id);

      expect(listA).toHaveLength(1);
      expect(listB).toHaveLength(0);
    });

    it("get and delete notification channel stay org-scoped", async () => {
      const orgA = await createTestOrg();
      const orgB = await createTestOrg();

      const channel = await queries.createNotificationChannel({
        id: "ch-del",
        orgId: orgA.id,
        kind: "slack",
        name: "#delete-me",
        config: {},
      });

      const foundA = await queries.getNotificationChannel(channel.id, orgA.id);
      const foundB = await queries.getNotificationChannel(channel.id, orgB.id);
      expect(foundA).not.toBeNull();
      expect(foundB).toBeNull();

      expect(await queries.deleteNotificationChannel(channel.id, orgB.id)).toBe(false);
      expect(await queries.deleteNotificationChannel(channel.id, orgA.id)).toBe(true);
    });

    it("alert rules and notification log entries work with tenant scoping", async () => {
      const orgA = await createTestOrg();
      const orgB = await createTestOrg();
      const channel = await queries.createNotificationChannel({
        id: "ch-rule",
        orgId: orgA.id,
        kind: "slack",
        name: "#ops",
        config: {},
      });

      const rule = await queries.createAlertRule({
        id: "rule-1",
        orgId: orgA.id,
        eventType: "agent_failure",
        minSeverity: "high",
        channelId: channel.id,
      });

      const orgARules = await queries.listAlertRules(orgA.id);
      const orgBRules = await queries.listAlertRules(orgB.id);
      expect(orgARules).toHaveLength(1);
      expect(orgBRules).toHaveLength(0);

      const enabledRules = await queries.getAlertRulesForOrg(orgA.id);
      expect(enabledRules).toHaveLength(1);
      expect(enabledRules[0]!.id).toBe(rule.id);

      const log = await queries.createNotificationLogEntry({
        id: "nlog-1",
        orgId: orgA.id,
        ruleId: rule.id,
        channelId: channel.id,
        eventType: "agent_failure",
        severity: "high",
        agentId: "agent-a",
        status: "sent",
      });
      expect(log.orgId).toBe(orgA.id);

      expect(await queries.deleteAlertRule(rule.id, orgB.id)).toBe(false);
      expect(await queries.deleteAlertRule(rule.id, orgA.id)).toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Usage records
  // ────────────────────────────────────────────────────────────────────────────

  describe("Usage records", () => {
    it("upsertUsageRecord creates and then increments", async () => {
      const org = await createTestOrg();
      const period = "2026-04";

      const first = await queries.upsertUsageRecord(org.id, period, 100);
      expect(first.spanCount).toBe(100);

      const second = await queries.upsertUsageRecord(org.id, period, 50);
      expect(second.spanCount).toBe(150);
    });

    it("getUsageForPeriod returns org-scoped usage record", async () => {
      const orgA = await createTestOrg();
      const orgB = await createTestOrg();
      const period = "2026-04";

      await queries.upsertUsageRecord(orgA.id, period, 25);
      await queries.upsertUsageRecord(orgB.id, period, 70);

      const usageA = await queries.getUsageForPeriod(orgA.id, period);
      const usageB = await queries.getUsageForPeriod(orgB.id, period);

      expect(usageA?.spanCount).toBe(25);
      expect(usageB?.spanCount).toBe(70);
    });
  });

  describe("Prompt management", () => {
    it("createPromptVersion increments versions atomically within one prompt", async () => {
      const org = await createTestOrg();
      const createdPrompt = await queries.createPrompt({ id: "prompt-1", orgId: org.id, name: "support" });
      expect(createdPrompt).toBeDefined();
      const prompt = createdPrompt!;

      const createdV1 = await queries.createPromptVersion({
        id: "pv-1",
        promptId: prompt.id,
        orgId: org.id,
        content: "Version 1",
      });
      const createdV2 = await queries.createPromptVersion({
        id: "pv-2",
        promptId: prompt.id,
        orgId: org.id,
        content: "Version 2",
      });
      const v1 = createdV1!;
      const v2 = createdV2!;

      expect(v1.version).toBe(1);
      expect(v2.version).toBe(2);

      const latest = await queries.getLatestPromptVersion(prompt.id, org.id);
      expect(latest?.version).toBe(2);
    });

    it("setPromptLabel moves label between versions of the same prompt", async () => {
      const org = await createTestOrg();
      const createdPrompt = await queries.createPrompt({ id: "prompt-label", orgId: org.id, name: "router" });
      expect(createdPrompt).toBeDefined();
      const prompt = createdPrompt!;
      const createdV1 = await queries.createPromptVersion({
        id: "pv-label-1",
        promptId: prompt.id,
        orgId: org.id,
        content: "old",
      });
      const createdV2 = await queries.createPromptVersion({
        id: "pv-label-2",
        promptId: prompt.id,
        orgId: org.id,
        content: "new",
      });
      const v1 = createdV1!;
      const v2 = createdV2!;

      await queries.setPromptLabel({
        id: "label-1",
        promptId: prompt.id,
        promptVersionId: v1.id,
        label: "production",
      });
      await queries.setPromptLabel({
        id: "label-2",
        promptId: prompt.id,
        promptVersionId: v2.id,
        label: "production",
      });

      const v1Labels = await queries.getLabelsForVersion(v1.id);
      const v2Labels = await queries.getLabelsForVersion(v2.id);
      expect(v1Labels).toHaveLength(0);
      expect(v2Labels).toHaveLength(1);

      const resolved = await queries.getPromptVersionByLabel(org.id, prompt.name, "production");
      expect(resolved?.id).toBe(v2.id);
    });
  });

  describe("Experiments", () => {
    it("experiment comparison returns null if any experiment is outside the org", async () => {
      const orgA = await createTestOrg();
      const orgB = await createTestOrg();
      const dsA = await createTestDataset(orgA.id);
      const dsB = await createTestDataset(orgB.id);

      const expA = await queries.createExperiment({
        id: "exp-a",
        orgId: orgA.id,
        datasetId: dsA.id,
        name: "Experiment A",
        config: {},
      });
      const expB = await queries.createExperiment({
        id: "exp-b",
        orgId: orgB.id,
        datasetId: dsB.id,
        name: "Experiment B",
        config: {},
      });

      const comparison = await queries.getExperimentComparison([expA.id, expB.id], orgA.id);
      expect(comparison).toBeNull();
    });
  });

  describe("SSO and platform", () => {
    it("jitProvisionUser creates membership once and reuses existing user on second call", async () => {
      const org = await createTestOrg();

      const first = await queries.jitProvisionUser({
        userId: "jit-user-1",
        email: "jit@test.dev",
        name: "Jit User",
        orgId: org.id,
      });
      expect(first.provisioned).toBe(true);

      const second = await queries.jitProvisionUser({
        userId: "jit-user-2",
        email: "jit@test.dev",
        name: "Jit User",
        orgId: org.id,
      });
      expect(second.provisioned).toBe(false);
      expect(second.user.id).toBe(first.user.id);

      const memberships = await queries.getMembershipsByUser(first.user.id);
      expect(memberships).toHaveLength(1);
      expect(memberships[0]!.org.id).toBe(org.id);
    });

    it("SSO config and sessions round-trip correctly", async () => {
      const org = await createTestOrg();
      const user = await createTestUser();
      await createTestMembership(user.id, org.id, "member");

      const config = await queries.upsertSsoConfig({
        id: "sso-1",
        orgId: org.id,
        provider: "oidc",
        config: { issuer: "https://issuer.test" },
        enforceSso: true,
      });
      expect(config.orgId).toBe(org.id);

      const foundConfig = await queries.getSsoConfigByOrg(org.id);
      expect(foundConfig?.provider).toBe("oidc");
      expect(foundConfig?.enforceSso).toBe(true);

      const session = await queries.createSsoSession({
        id: "sso-session-1",
        userId: user.id,
        orgId: org.id,
        idpSessionId: "idp-1",
        expiresAt: new Date(Date.now() + 60_000),
      });
      expect(session.orgId).toBe(org.id);

      const foundSession = await queries.getSsoSession("sso-session-1");
      expect(foundSession?.idpSessionId).toBe("idp-1");

      await queries.deleteSsoSessionByIdpSession("idp-1");
      const deletedSession = await queries.getSsoSession("sso-session-1");
      expect(deletedSession).toBeNull();

      expect(await queries.deleteSsoConfig(org.id)).toBe(true);
      expect(await queries.getSsoConfigByOrg(org.id)).toBeNull();
    });

    it("agent config and baselines support lifecycle operations", async () => {
      const org = await createTestOrg();

      const config = await queries.upsertAgentConfig({
        id: "agent-config-1",
        orgId: org.id,
        agentId: "agent-a",
        costBudgetUsd: "25.00",
        maxDurationMs: 5000,
      });
      expect(config.agentId).toBe("agent-a");

      const foundConfig = await queries.getAgentConfig(org.id, "agent-a");
      expect(foundConfig?.costBudgetUsd).toBe("25.00");

      await queries.updateAgentConfigStatus(org.id, "agent-a", { state: "warning" }, null);
      const updatedConfig = await queries.getAgentConfig(org.id, "agent-a");
      expect(updatedConfig?.lastCostStatus).toEqual({ state: "warning" });

      const baseline = await queries.upsertBaseline({
        id: "baseline-1",
        orgId: org.id,
        agentId: "agent-a",
        agentVersion: "v1",
        sampleSize: 10,
        spanStructure: { "llm_call:respond": 1 },
      });
      expect(baseline.agentVersion).toBe("v1");

      const foundBaseline = await queries.getBaseline(org.id, "agent-a", "v1");
      expect(foundBaseline?.sampleSize).toBe(10);

      const recent = await queries.getRecentBaselines(org.id, "agent-a");
      expect(recent).toHaveLength(1);

      expect(await queries.deleteBaseline(org.id, "agent-a", "v1")).toBe(true);
      expect(await queries.deleteAgentConfig(org.id, "agent-a")).toBe(true);
    });

    it("insertWaitlistSignup deduplicates by normalized email", async () => {
      const first = await queries.insertWaitlistSignup("wait-1", "Test@Example.com ");
      const second = await queries.insertWaitlistSignup("wait-2", "test@example.com");

      expect(first).toEqual({ alreadyExists: false });
      expect(second).toEqual({ alreadyExists: true });
    });
  });
});
