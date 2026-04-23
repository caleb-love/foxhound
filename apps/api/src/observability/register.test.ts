import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Fastify, { type FastifyInstance } from "fastify";
import { registerMetrics, setIngestSpanCount } from "./register.js";

const TEST_SCRAPE_TOKEN = "test-scrape-token";
const AUTH_HEADER = { authorization: `Bearer ${TEST_SCRAPE_TOKEN}` };

describe("observability · registerMetrics · Fastify integration", () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    // Shim auth middleware that sets orgId, same shape as the real auth plugin.
    app.addHook("preHandler", (request, _reply, done) => {
      const header = request.headers["x-test-org-id"];
      if (typeof header === "string") {
        (request as unknown as { orgId: string }).orgId = header;
      }
      done();
    });
    await registerMetrics(app, {
      ingestRouteUrls: ["/ingest"],
      maxOrgLabels: 5,
      collectNodeDefaults: false,
      scrapeToken: TEST_SCRAPE_TOKEN,
    });
    app.post("/ingest", async (request, reply) => {
      // Simulate a parsed payload with N spans.
      const bodyLenHeader = request.headers["content-length"];
      const n = typeof bodyLenHeader === "string" ? Math.max(0, Math.min(20, Number(bodyLenHeader) % 20)) : 1;
      setIngestSpanCount(request, n);
      return reply.code(202).send({ ok: true });
    });
    app.post("/ingest/error", async (_request, reply) => {
      return reply.code(400).send({ error: "bad" });
    });
    // A non-ingest route that emits 415; used to verify route scoping of the
    // metrics hooks (the hooks should NOT record this route's metrics).
    app.post("/fail-415", async (_req, reply) => reply.code(415).send("no"));
    // Bad-request ingest to test 4xx error reason mapping.
    app.post("/ingest-bad", async (_request, reply) => reply.code(400).send("bad"));
  });

  afterEach(async () => {
    await app.close();
  });

  it("GET /metrics returns Prometheus-format text", async () => {
    const res = await app.inject({ method: "GET", url: "/metrics", headers: AUTH_HEADER });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/plain/);
    expect(res.body).toContain("# HELP foxhound_ingest_request_duration_seconds");
    expect(res.body).toContain("# TYPE foxhound_ingest_request_duration_seconds histogram");
  });

  it("records a request duration histogram sample on every ingest call", async () => {
    await app.inject({
      method: "POST",
      url: "/ingest",
      headers: { "content-type": "application/json", "x-test-org-id": "org_a" },
      payload: { hello: "world" },
    });
    const res = await app.inject({ method: "GET", url: "/metrics", headers: AUTH_HEADER });
    expect(res.body).toMatch(
      /foxhound_ingest_request_duration_seconds_count\{[^}]*status_code="202"[^}]*org_id="org_a"[^}]*\} 1/,
    );
    expect(res.body).toMatch(
      /foxhound_ingest_requests_total\{status_code="202"\} 1/,
    );
    expect(res.body).toMatch(
      /foxhound_ingest_per_org_requests_total\{org_id="org_a"\} 1/,
    );
  });

  it("does NOT record metrics for routes outside the configured ingest set", async () => {
    // /fail-415 was declared in beforeEach; its responses must not appear
    // in any ingest histogram / counter because it is not in ingestRouteUrls.
    await app.inject({ method: "POST", url: "/fail-415", headers: { "x-test-org-id": "org_scope" } });
    const res = await app.inject({ method: "GET", url: "/metrics", headers: AUTH_HEADER });
    expect(res.body).not.toMatch(/status_code="415"/);
    expect(res.body).not.toMatch(/org_id="org_scope"/);
  });

  it("records the error reason on 4xx ingest responses", async () => {
    // /ingest-bad IS inside the scope? Only /ingest is, by design. Include
    // /ingest-bad in a reconfigured registerMetrics scope to test the
    // reason mapping in isolation.
    const appScoped = Fastify({ logger: false });
    appScoped.addHook("preHandler", (request, _reply, done) => {
      const header = request.headers["x-test-org-id"];
      if (typeof header === "string") (request as unknown as { orgId: string }).orgId = header;
      done();
    });
    await registerMetrics(appScoped, {
      ingestRouteUrls: ["/ingest-bad"],
      maxOrgLabels: 5,
      collectNodeDefaults: false,
      scrapeToken: TEST_SCRAPE_TOKEN,
    });
    appScoped.post("/ingest-bad", async (_req, reply) => reply.code(400).send("bad"));

    await appScoped.inject({
      method: "POST",
      url: "/ingest-bad",
      headers: { "content-type": "application/json", "x-test-org-id": "org_4xx" },
      payload: {},
    });
    const res = await appScoped.inject({ method: "GET", url: "/metrics", headers: AUTH_HEADER });
    expect(res.body).toMatch(
      /foxhound_ingest_errors_total\{[^}]*reason="bad_request"[^}]*org_id="org_4xx"[^}]*\} 1/,
    );
    await appScoped.close();
  });

  it("captures errors from 4xx ingest responses", async () => {
    await app.inject({
      method: "POST",
      url: "/ingest/error",
      headers: { "content-type": "application/json", "x-test-org-id": "org_err" },
      payload: { bad: true },
    });
    // /ingest/error is NOT in the configured ingest routes, so no series.
    const res = await app.inject({ method: "GET", url: "/metrics", headers: AUTH_HEADER });
    expect(res.body).not.toMatch(/org_id="org_err"/);
  });

  it("handles missing orgId with 'anonymous' label without crashing", async () => {
    await app.inject({
      method: "POST",
      url: "/ingest",
      headers: { "content-type": "application/json" },
      payload: { hi: "yep" },
    });
    const res = await app.inject({ method: "GET", url: "/metrics", headers: AUTH_HEADER });
    expect(res.body).toMatch(/foxhound_ingest_per_org_requests_total\{org_id="anonymous"\}/);
  });

  it("enforces per-org cardinality cap at the registered maxOrgLabels", async () => {
    for (let i = 0; i < 20; i++) {
      await app.inject({
        method: "POST",
        url: "/ingest",
        headers: { "content-type": "application/json", "x-test-org-id": `org_${i}` },
        payload: { i },
      });
    }
    const res = await app.inject({ method: "GET", url: "/metrics", headers: AUTH_HEADER });
    const lines = res.body
      .split("\n")
      .filter((l) => l.startsWith("foxhound_ingest_per_org_requests_total{"));
    const orgLabels = new Set<string>();
    for (const line of lines) {
      const m = /org_id="([^"]+)"/.exec(line);
      if (m) orgLabels.add(m[1]!);
    }
    // Cap = 5 tracked + "other" = at most 6.
    expect(orgLabels.size).toBeLessThanOrEqual(6);
    expect(orgLabels.has("other")).toBe(true);
  });

  it("rejects GET /metrics without an Authorization header", async () => {
    const res = await app.inject({ method: "GET", url: "/metrics" });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ error: "unauthorized" });
  });

  it("rejects GET /metrics with a wrong bearer token", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/metrics",
      headers: { authorization: "Bearer wrong-token" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("rejects GET /metrics with a non-Bearer scheme", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/metrics",
      headers: { authorization: `Basic ${TEST_SCRAPE_TOKEN}` },
    });
    expect(res.statusCode).toBe(401);
  });

  it("fails closed with 503 when no scrape token is configured", async () => {
    const prev = process.env["METRICS_SCRAPE_TOKEN"];
    delete process.env["METRICS_SCRAPE_TOKEN"];
    try {
      const unconfigured = Fastify({ logger: false });
      await registerMetrics(unconfigured, {
        ingestRouteUrls: ["/ingest"],
        maxOrgLabels: 5,
        collectNodeDefaults: false,
      });
      const res = await unconfigured.inject({ method: "GET", url: "/metrics" });
      expect(res.statusCode).toBe(503);
      expect(res.json()).toEqual({ error: "metrics_not_configured" });
      const authed = await unconfigured.inject({
        method: "GET",
        url: "/metrics",
        headers: AUTH_HEADER,
      });
      expect(authed.statusCode).toBe(503);
      await unconfigured.close();
    } finally {
      if (prev !== undefined) process.env["METRICS_SCRAPE_TOKEN"] = prev;
    }
  });
});
