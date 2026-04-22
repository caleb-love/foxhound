// k6 scenario: baseline — 1,000 RPS for 5 minutes by default.
// Drives `POST /v1/traces/otlp` with OTLP/HTTP JSON batches. Use this scenario
// to capture the "before" numbers on the current code path (pre-WP04, JSON,
// no durable queue).
//
// Run:
//   LOAD_TEST_URL=http://localhost:3000 \
//   LOAD_TEST_API_KEY=fh_xxx \
//   LOAD_TEST_RPS=1000 \
//   LOAD_TEST_DURATION=300 \
//   k6 run --summary-export=tools/loadgen/.k6-summary.json \
//     tools/loadgen/scenarios/ingest-baseline.js
import http from "k6/http";
import { check } from "k6";
import { buildPayload, envCsv, envInt, envStr } from "./_span-generator.js";

const URL = envStr("LOAD_TEST_URL", "http://localhost:3000");
const API_KEY = envStr("LOAD_TEST_API_KEY", "");
const RPS = envInt("LOAD_TEST_RPS", 1000);
const DURATION_S = envInt("LOAD_TEST_DURATION", 300);
const ORG_IDS = envCsv("LOAD_TEST_ORG_IDS", ["org_a", "org_b", "org_c"]);
const SPANS_PER_TRACE = envInt("LOAD_TEST_SPANS_PER_TRACE", 4);

export const options = {
  discardResponseBodies: true,
  scenarios: {
    baseline: {
      executor: "constant-arrival-rate",
      rate: RPS,
      timeUnit: "1s",
      duration: `${DURATION_S}s`,
      preAllocatedVUs: Math.max(50, Math.ceil(RPS / 20)),
      maxVUs: Math.max(200, Math.ceil(RPS / 5)),
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(99)<1500"], // loose on current code; tightened by later WPs
  },
};

export default function () {
  if (!API_KEY) throw new Error("LOAD_TEST_API_KEY is required");

  const orgId = ORG_IDS[Math.floor(Math.random() * ORG_IDS.length)];
  const body = buildPayload({ orgId, spansPerTrace: SPANS_PER_TRACE });

  const res = http.post(`${URL}/v1/traces/otlp`, body, {
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${API_KEY}`,
    },
    timeout: "30s",
    tags: { scenario: "baseline", org_id: orgId },
  });

  check(res, {
    "status is 2xx": (r) => r.status >= 200 && r.status < 300,
  });
}
