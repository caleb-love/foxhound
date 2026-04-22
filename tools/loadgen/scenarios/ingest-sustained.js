// k6 scenario: sustained — the program's target floor. 35,000 RPS (~1B
// spans/day at 4 spans/trace) for 30 minutes.
//
// This scenario WILL fail on the current code path (pre-WP04 and pre-WP08).
// That is the point: it encodes the gate and makes regression detection real.
import http from "k6/http";
import { check } from "k6";
import { buildPayload, envCsv, envInt, envStr } from "./_span-generator.js";

const URL = envStr("LOAD_TEST_URL", "http://localhost:3000");
const API_KEY = envStr("LOAD_TEST_API_KEY", "");
const RPS = envInt("LOAD_TEST_RPS", 35000);
const DURATION_S = envInt("LOAD_TEST_DURATION", 1800);
const ORG_IDS = envCsv("LOAD_TEST_ORG_IDS", ["org_a", "org_b", "org_c"]);
const SPANS_PER_TRACE = envInt("LOAD_TEST_SPANS_PER_TRACE", 4);

export const options = {
  discardResponseBodies: true,
  scenarios: {
    sustained: {
      executor: "constant-arrival-rate",
      rate: RPS,
      timeUnit: "1s",
      duration: `${DURATION_S}s`,
      preAllocatedVUs: Math.max(500, Math.ceil(RPS / 20)),
      maxVUs: Math.max(2000, Math.ceil(RPS / 3)),
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    // Program target: 500ms p99. This threshold ratchets as WP04 → WP08 land.
    http_req_duration: ["p(99)<500"],
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
    tags: { scenario: "sustained", org_id: orgId },
  });
  check(res, { "status is 2xx": (r) => r.status >= 200 && r.status < 300 });
}
