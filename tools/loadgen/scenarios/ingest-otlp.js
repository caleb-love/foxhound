// k6 scenario: OTLP/Protobuf ingest.
//
// Posts the precomputed `foxhound.v1.TraceBatch` binary fixture at
// `POST /v1/traces` with `Content-Type: application/x-protobuf`.
//
// The fixture is generated once by the operator via:
//   tsx tools/loadgen/scripts/build-proto-fixture.ts
// and committed at `scenarios/fixtures/trace-batch.v1.b64`. Because k6 runs
// its own JS runtime (Goja) with no npm support, it cannot invoke
// `@foxhound/proto` directly; the base64 fixture is the bridge.
//
// Run (default: 1,000 RPS for 5 minutes):
//   LOAD_TEST_API_KEY=fh_live_xxx \
//   k6 run --summary-export=tools/loadgen/.k6-summary.json \
//     tools/loadgen/scenarios/ingest-otlp.js
import http from "k6/http";
import encoding from "k6/encoding";
import { check } from "k6";
import { envCsv, envInt, envStr } from "./_span-generator.js";

const URL = envStr("LOAD_TEST_URL", "http://localhost:3000");
const API_KEY = envStr("LOAD_TEST_API_KEY", "");
const RPS = envInt("LOAD_TEST_RPS", 1000);
const DURATION_S = envInt("LOAD_TEST_DURATION", 300);
const ORG_IDS = envCsv("LOAD_TEST_ORG_IDS", ["org_a", "org_b", "org_c"]);

// Load the base64-encoded protobuf fixture at init time (k6 init stage runs
// once per VU spawn; loaded bytes are shared, not re-decoded per request).
const FIXTURE_B64 = open("./fixtures/trace-batch.v1.b64").trim();
const FIXTURE_BYTES = encoding.b64decode(FIXTURE_B64, "std", "b");

export const options = {
  discardResponseBodies: true,
  scenarios: {
    otlp_baseline: {
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
    // Program target: p99 < 500ms on the sustained scenario. Baseline is
    // more forgiving; tightens as WP04 → WP08 land.
    http_req_duration: ["p(99)<1500"],
  },
};

export default function () {
  if (!API_KEY) throw new Error("LOAD_TEST_API_KEY is required");
  const orgId = ORG_IDS[Math.floor(Math.random() * ORG_IDS.length)];

  const res = http.post(`${URL}/v1/traces`, FIXTURE_BYTES, {
    headers: {
      "Content-Type": "application/x-protobuf",
      Authorization: `Bearer ${API_KEY}`,
      "X-Foxhound-Wire": "protobuf",
      "X-Foxhound-Schema": "v1",
    },
    timeout: "30s",
    tags: { scenario: "otlp", wire: "protobuf", org_id: orgId },
  });

  check(res, {
    "status is 2xx": (r) => r.status >= 200 && r.status < 300,
  });
}
