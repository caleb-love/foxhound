// k6 scenario: burst — climb to 10,000 RPS over 30 seconds, hold for 5 minutes.
// Purpose: surface the knee of the current ingest path. The baseline in-memory
// 200-trace buffer is expected to saturate; this scenario quantifies how.
import http from "k6/http";
import { check } from "k6";
import { buildPayload, envCsv, envInt, envStr } from "./_span-generator.js";

const URL = envStr("LOAD_TEST_URL", "http://localhost:3000");
const API_KEY = envStr("LOAD_TEST_API_KEY", "");
const RPS = envInt("LOAD_TEST_RPS", 10000);
const DURATION_S = envInt("LOAD_TEST_DURATION", 300);
const ORG_IDS = envCsv("LOAD_TEST_ORG_IDS", ["org_a", "org_b", "org_c"]);
const SPANS_PER_TRACE = envInt("LOAD_TEST_SPANS_PER_TRACE", 4);

export const options = {
  discardResponseBodies: true,
  scenarios: {
    burst: {
      executor: "ramping-arrival-rate",
      startRate: 100,
      timeUnit: "1s",
      preAllocatedVUs: Math.max(200, Math.ceil(RPS / 10)),
      maxVUs: Math.max(500, Math.ceil(RPS / 2)),
      stages: [
        { duration: "30s", target: RPS },
        { duration: `${DURATION_S}s`, target: RPS },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(99)<3000"],
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
    tags: { scenario: "burst", org_id: orgId },
  });
  check(res, { "status is 2xx": (r) => r.status >= 200 && r.status < 300 });
}
