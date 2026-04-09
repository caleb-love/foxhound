# Phase 1: Cloud Platform Launch — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the #1 growth ceiling by shipping a hosted cloud version of Foxhound with Stripe billing, updated entitlements matching roadmap pricing, and a `foxhound init` CLI command for <2-minute onboarding.

**Architecture:** The API server gets containerized (Dockerfile) and deployed to Fly.io with Neon Postgres. Billing routes (already 100% implemented but commented out) are enabled and entitlements updated to match roadmap pricing (Free: 100K, Pro: 1M, Team: 5M). The `requireEntitlement` middleware gets a cloud mode that enforces plan gates. A `foxhound init` CLI command auto-detects frameworks and generates instrumentation boilerplate. A GitHub Actions deploy workflow automates shipping on merge to main.

**Tech Stack:** Fastify, Stripe, Fly.io, Neon Postgres, Upstash Redis, Docker, Commander.js, Vitest

---

## File Map

| File                                           | Action | Responsibility                                             |
| ---------------------------------------------- | ------ | ---------------------------------------------------------- |
| `packages/billing/src/entitlements.ts`         | Modify | Update PLAN_LIMITS to roadmap pricing, add "team" plan     |
| `packages/billing/src/entitlements.test.ts`    | Modify | Update test assertions for new limits, add team plan tests |
| `packages/billing/src/metering.ts`             | Modify | Update free tier threshold check for 100K                  |
| `packages/billing/src/metering.test.ts`        | Modify | Update test assertions for new limits                      |
| `packages/billing/src/index.ts`                | Modify | Export new Plan type with "team"                           |
| `packages/db/src/schema.ts`                    | Modify | Add "team" to plan enum                                    |
| `apps/api/src/index.ts`                        | Modify | Uncomment billing routes                                   |
| `apps/api/src/middleware/entitlements.ts`      | Modify | Add cloud-mode entitlement enforcement                     |
| `apps/api/src/middleware/entitlements.test.ts` | Modify | Add tests for cloud-mode enforcement                       |
| `apps/api/src/routes/billing.ts`               | Modify | Add team plan price handling                               |
| `apps/api/src/routes/billing.test.ts`          | Modify | Update test for team plan                                  |
| `packages/api-client/src/index.ts`             | Modify | Add billing client methods                                 |
| `packages/api-client/src/types.ts`             | Modify | Add billing response types                                 |
| `packages/cli/src/index.ts`                    | Modify | Register init command                                      |
| `packages/cli/src/commands/init.ts`            | Create | `foxhound init` command with framework detection           |
| `Dockerfile`                                   | Create | Multi-stage Docker build for API server                    |
| `fly.toml`                                     | Create | Fly.io deployment config                                   |
| `.dockerignore`                                | Create | Exclude node_modules, .git, etc.                           |
| `.github/workflows/deploy.yml`                 | Create | CD pipeline for Fly.io deploy on main push                 |
| `apps/api/.env.example`                        | Modify | Add Redis/Neon env vars                                    |

---

### Task 1: Update Plan Limits to Match Roadmap Pricing

**Files:**

- Modify: `packages/db/src/schema.ts:23-25`
- Modify: `packages/billing/src/entitlements.ts:13-43`
- Modify: `packages/billing/src/entitlements.test.ts`
- Modify: `packages/billing/src/metering.ts:50`
- Modify: `packages/billing/src/metering.test.ts`
- Modify: `packages/billing/src/index.ts`

The roadmap pricing is: Free 100K spans/30d retention, Pro 1M spans/365d, Team 5M spans/730d, Enterprise unlimited/unlimited. All features unlocked on all tiers (no feature gates — volume-limited only). Unlimited users on all tiers.

- [ ] **Step 1: Update the schema plan enum to include "team"**

In `packages/db/src/schema.ts`, change the plan enum from `["free", "pro", "enterprise"]` to `["free", "pro", "team", "enterprise"]`.

```typescript
plan: text("plan", { enum: ["free", "pro", "team", "enterprise"] })
  .notNull()
  .default("free"),
```

- [ ] **Step 2: Update the Plan type and PLAN_LIMITS in entitlements.ts**

In `packages/billing/src/entitlements.ts`:

```typescript
export type Plan = "free" | "pro" | "team" | "enterprise";

const PLAN_LIMITS: Record<Plan, Entitlements> = {
  free: {
    canReplay: true,
    canRunDiff: true,
    canAuditLog: false,
    maxSpans: 100_000,
    maxProjects: -1,
    maxSeats: -1,
    retentionDays: 30,
  },
  pro: {
    canReplay: true,
    canRunDiff: true,
    canAuditLog: false,
    maxSpans: 1_000_000,
    maxProjects: -1,
    maxSeats: -1,
    retentionDays: 365,
  },
  team: {
    canReplay: true,
    canRunDiff: true,
    canAuditLog: true,
    maxSpans: 5_000_000,
    maxProjects: -1,
    maxSeats: -1,
    retentionDays: 730,
  },
  enterprise: {
    canReplay: true,
    canRunDiff: true,
    canAuditLog: true,
    maxSpans: -1,
    maxProjects: -1,
    maxSeats: -1,
    retentionDays: 365,
  },
};
```

Key changes: All features unlocked on free (per roadmap "No feature gates on Free"). Unlimited projects/seats on all tiers. Free: 100K spans, 30 days. Pro: 1M spans, 1 year. Team: 5M spans, 2 years. Enterprise: unlimited.

- [ ] **Step 3: Update the free tier threshold in metering.ts**

In `packages/billing/src/metering.ts`, line 50, update the free tier check:

```typescript
const isFree = spansLimit <= 100_000;
```

This changes from `10_000` to `100_000` to match the new free tier limit.

- [ ] **Step 4: Update entitlements.test.ts assertions**

Replace the full test file content. Key changes: free plan now has `canReplay: true`, `maxSpans: 100_000`, `retentionDays: 30`. Pro now has `maxSpans: 1_000_000`, `retentionDays: 365`. Add team plan test. Update org factory to support "team" plan.

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Plan } from "./entitlements.js";

vi.mock("@foxhound/db", () => ({
  getOrganizationById: vi.fn(),
}));

import * as db from "@foxhound/db";
import { getEntitlements, invalidateEntitlements } from "./entitlements.js";

function makeOrg(plan: Plan) {
  return {
    id: "org_1",
    name: "Test Org",
    slug: "test-org",
    plan,
    stripeCustomerId: null,
    retentionDays: 90,
    samplingRate: 1.0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("getEntitlements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateEntitlements("org_1");
    invalidateEntitlements("org_pro");
    invalidateEntitlements("org_team");
    invalidateEntitlements("org_enterprise");
  });

  it("returns free plan limits for a free-tier org", async () => {
    vi.mocked(db.getOrganizationById).mockResolvedValue(makeOrg("free"));

    const e = await getEntitlements("org_1");

    expect(e.canReplay).toBe(true);
    expect(e.canRunDiff).toBe(true);
    expect(e.canAuditLog).toBe(false);
    expect(e.maxSpans).toBe(100_000);
    expect(e.maxProjects).toBe(-1);
    expect(e.maxSeats).toBe(-1);
    expect(e.retentionDays).toBe(30);
  });

  it("returns pro plan limits for a pro-tier org", async () => {
    vi.mocked(db.getOrganizationById).mockResolvedValue(makeOrg("pro"));

    const e = await getEntitlements("org_pro");

    expect(e.canReplay).toBe(true);
    expect(e.canRunDiff).toBe(true);
    expect(e.canAuditLog).toBe(false);
    expect(e.maxSpans).toBe(1_000_000);
    expect(e.retentionDays).toBe(365);
  });

  it("returns team plan limits for a team-tier org", async () => {
    vi.mocked(db.getOrganizationById).mockResolvedValue(makeOrg("team"));

    const e = await getEntitlements("org_team");

    expect(e.canReplay).toBe(true);
    expect(e.canRunDiff).toBe(true);
    expect(e.canAuditLog).toBe(true);
    expect(e.maxSpans).toBe(5_000_000);
    expect(e.maxProjects).toBe(-1);
    expect(e.maxSeats).toBe(-1);
    expect(e.retentionDays).toBe(730);
  });

  it("returns enterprise plan limits for an enterprise org", async () => {
    vi.mocked(db.getOrganizationById).mockResolvedValue(makeOrg("enterprise"));

    const e = await getEntitlements("org_enterprise");

    expect(e.canReplay).toBe(true);
    expect(e.canRunDiff).toBe(true);
    expect(e.canAuditLog).toBe(true);
    expect(e.maxSpans).toBe(-1);
    expect(e.retentionDays).toBe(365);
  });

  it("defaults to free limits when org not found", async () => {
    vi.mocked(db.getOrganizationById).mockResolvedValue(null);

    const e = await getEntitlements("org_1");

    expect(e.canReplay).toBe(true);
    expect(e.canRunDiff).toBe(true);
    expect(db.getOrganizationById).toHaveBeenCalledTimes(1);
  });

  it("caches entitlements and skips subsequent DB calls", async () => {
    vi.mocked(db.getOrganizationById).mockResolvedValue(makeOrg("pro"));

    await getEntitlements("org_pro");
    await getEntitlements("org_pro");
    await getEntitlements("org_pro");

    expect(db.getOrganizationById).toHaveBeenCalledTimes(1);
  });

  it("re-fetches after cache invalidation", async () => {
    vi.mocked(db.getOrganizationById).mockResolvedValue(makeOrg("free"));

    await getEntitlements("org_1");
    invalidateEntitlements("org_1");

    vi.mocked(db.getOrganizationById).mockResolvedValue(makeOrg("pro"));
    const e = await getEntitlements("org_1");

    expect(db.getOrganizationById).toHaveBeenCalledTimes(2);
    expect(e.canReplay).toBe(true);
  });
});
```

- [ ] **Step 5: Update metering.test.ts assertions**

Update the free tier tests to use `100_000` limit and pro to `1_000_000`:

In `describe("checkSpanLimit — free tier")`:

- `mockEntitlements(100_000)` (was `10_000`)
- Adjust test span counts: "under limit" uses `50_000` + `1_000`, "at boundary" uses `50_000` + `50_000`, "exceeds" uses `99_000` + `2_000`, "at limit" uses `100_000` + `1`.

In `describe("checkSpanLimit — pro tier")`:

- `mockEntitlements(1_000_000)` (was `500_000`)
- Adjust: "under limit" uses `500_000` + `1_000`, "exceeds" uses `999_000` + `5_000`, "well past" uses `1_200_000` + `1_000`.

Add new `describe("checkSpanLimit — team tier")` block with `mockEntitlements(5_000_000)` and similar tests.

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@foxhound/db", () => ({
  getUsageForPeriod: vi.fn(),
  upsertUsageRecord: vi.fn(),
}));

vi.mock("./entitlements.js", () => ({
  getEntitlements: vi.fn(),
}));

import * as db from "@foxhound/db";
import * as entitlementsMod from "./entitlements.js";
import {
  checkSpanLimit,
  incrementSpanCount,
  currentBillingPeriod,
  periodBounds,
} from "./metering.js";

function mockEntitlements(maxSpans: number) {
  vi.mocked(entitlementsMod.getEntitlements).mockResolvedValue({
    canReplay: true,
    canRunDiff: true,
    canAuditLog: false,
    maxSpans,
    maxProjects: -1,
    maxSeats: -1,
    retentionDays: 30,
  });
}

function mockUsage(spanCount: number | null) {
  vi.mocked(db.getUsageForPeriod).mockResolvedValue(
    spanCount === null
      ? null
      : ({ orgId: "org_1", period: "2026-04", spanCount, updatedAt: new Date() } as never),
  );
}

describe("currentBillingPeriod", () => {
  it("returns YYYY-MM format", () => {
    const period = currentBillingPeriod();
    expect(period).toMatch(/^\d{4}-\d{2}$/);
  });
});

describe("periodBounds", () => {
  it("returns correct start and end for January", () => {
    const { periodStart, periodEnd } = periodBounds("2026-01");
    expect(periodStart).toBe("2026-01-01");
    expect(periodEnd).toBe("2026-01-31");
  });

  it("returns correct start and end for April", () => {
    const { periodStart, periodEnd } = periodBounds("2026-04");
    expect(periodStart).toBe("2026-04-01");
    expect(periodEnd).toBe("2026-04-30");
  });

  it("handles February correctly", () => {
    const { periodStart, periodEnd } = periodBounds("2024-02");
    expect(periodStart).toBe("2024-02-01");
    expect(periodEnd).toBe("2024-02-29");
  });
});

describe("checkSpanLimit — free tier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEntitlements(100_000);
  });

  it("allows ingestion when under limit", async () => {
    mockUsage(50_000);
    const check = await checkSpanLimit("org_1", 1_000);
    expect(check.allowed).toBe(true);
    expect(check.isOverage).toBe(false);
    expect(check.spansUsed).toBe(50_000);
    expect(check.spansLimit).toBe(100_000);
  });

  it("allows ingestion exactly at limit boundary", async () => {
    mockUsage(50_000);
    const check = await checkSpanLimit("org_1", 50_000);
    expect(check.allowed).toBe(true);
    expect(check.isOverage).toBe(false);
  });

  it("blocks ingestion when it would exceed limit", async () => {
    mockUsage(99_000);
    const check = await checkSpanLimit("org_1", 2_000);
    expect(check.allowed).toBe(false);
    expect(check.isOverage).toBe(true);
  });

  it("blocks when already at limit", async () => {
    mockUsage(100_000);
    const check = await checkSpanLimit("org_1", 1);
    expect(check.allowed).toBe(false);
    expect(check.isOverage).toBe(true);
  });

  it("allows when no usage record exists yet", async () => {
    mockUsage(null);
    const check = await checkSpanLimit("org_1", 100);
    expect(check.allowed).toBe(true);
    expect(check.spansUsed).toBe(0);
  });
});

describe("checkSpanLimit — pro tier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEntitlements(1_000_000);
  });

  it("allows ingestion under pro limit without overage", async () => {
    mockUsage(500_000);
    const check = await checkSpanLimit("org_1", 1_000);
    expect(check.allowed).toBe(true);
    expect(check.isOverage).toBe(false);
  });

  it("allows ingestion that would exceed pro limit (overage — not hard blocked)", async () => {
    mockUsage(999_000);
    const check = await checkSpanLimit("org_1", 5_000);
    expect(check.allowed).toBe(true);
    expect(check.isOverage).toBe(true);
  });

  it("allows ingestion well past pro limit and flags overage", async () => {
    mockUsage(1_200_000);
    const check = await checkSpanLimit("org_1", 1_000);
    expect(check.allowed).toBe(true);
    expect(check.isOverage).toBe(true);
  });
});

describe("checkSpanLimit — team tier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEntitlements(5_000_000);
  });

  it("allows ingestion under team limit", async () => {
    mockUsage(2_000_000);
    const check = await checkSpanLimit("org_1", 10_000);
    expect(check.allowed).toBe(true);
    expect(check.isOverage).toBe(false);
  });

  it("allows overage without hard block", async () => {
    mockUsage(4_999_000);
    const check = await checkSpanLimit("org_1", 5_000);
    expect(check.allowed).toBe(true);
    expect(check.isOverage).toBe(true);
  });
});

describe("checkSpanLimit — enterprise tier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEntitlements(-1);
  });

  it("always allows ingestion regardless of usage", async () => {
    mockUsage(999_999_999);
    const check = await checkSpanLimit("org_1", 1_000_000);
    expect(check.allowed).toBe(true);
    expect(check.isOverage).toBe(false);
    expect(check.spansLimit).toBe(-1);
  });
});

describe("incrementSpanCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.upsertUsageRecord).mockResolvedValue({} as never);
  });

  it("calls upsertUsageRecord with orgId, current period, and count", async () => {
    await incrementSpanCount("org_1", 42);
    expect(db.upsertUsageRecord).toHaveBeenCalledWith("org_1", currentBillingPeriod(), 42);
  });

  it("uses the correct period", async () => {
    await incrementSpanCount("org_2", 100);
    const period = currentBillingPeriod();
    expect(db.upsertUsageRecord).toHaveBeenCalledWith("org_2", period, 100);
  });
});
```

- [ ] **Step 6: Run billing package tests**

Run: `pnpm --filter @foxhound/billing test`
Expected: All tests pass with updated assertions.

- [ ] **Step 7: Commit**

```bash
git add packages/db/src/schema.ts packages/billing/src/entitlements.ts packages/billing/src/entitlements.test.ts packages/billing/src/metering.ts packages/billing/src/metering.test.ts packages/billing/src/index.ts
git commit -m "Update plan limits to roadmap pricing: Free 100K, Pro 1M, Team 5M"
```

---

### Task 2: Enable Billing Routes and Add Team Plan Support

**Files:**

- Modify: `apps/api/src/index.ts:9-10,53-54`
- Modify: `apps/api/src/routes/billing.ts:39-43,62-66`
- Modify: `apps/api/src/routes/billing-webhook.ts:27,35`

- [ ] **Step 1: Uncomment billing imports and route registration in index.ts**

In `apps/api/src/index.ts`, uncomment lines 9-10 and 53-54:

```typescript
import { billingRoutes } from "./routes/billing.js";
import { billingWebhookRoutes } from "./routes/billing-webhook.js";
```

And:

```typescript
await app.register(billingRoutes);
await app.register(billingWebhookRoutes);
```

Remove the `// disabled: paid plans not active` comments.

- [ ] **Step 2: Add team plan checkout support in billing.ts**

In `apps/api/src/routes/billing.ts`, update the `CheckoutSchema` to accept team plans:

```typescript
const CheckoutSchema = z.object({
  plan: z.enum(["pro_monthly", "pro_annual", "team_monthly", "team_annual"]),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});
```

Update the priceId lookup in the checkout handler:

```typescript
const priceMap: Record<string, string | undefined> = {
  pro_monthly: process.env["STRIPE_PRICE_ID_PRO_MONTHLY"],
  pro_annual: process.env["STRIPE_PRICE_ID_PRO_ANNUAL"],
  team_monthly: process.env["STRIPE_PRICE_ID_TEAM_MONTHLY"],
  team_annual: process.env["STRIPE_PRICE_ID_TEAM_ANNUAL"],
};
const priceId = priceMap[plan];
```

- [ ] **Step 3: Update webhook to handle team plan subscriptions**

In `apps/api/src/routes/billing-webhook.ts`, update the `handleSubscriptionEvent` function to detect team plans. After line 35, check for the team price IDs:

```typescript
if (subscription.status === "active" || subscription.status === "trialing") {
  if (org.plan === "enterprise") {
    plan = "enterprise";
  } else {
    // Determine plan from price — default to pro
    const priceId = subscription.items.data[0]?.price?.id;
    const teamPriceIds = [
      process.env["STRIPE_PRICE_ID_TEAM_MONTHLY"],
      process.env["STRIPE_PRICE_ID_TEAM_ANNUAL"],
    ].filter(Boolean);
    plan = teamPriceIds.includes(priceId) ? "team" : "pro";
  }
}
```

- [ ] **Step 4: Add team price env vars to .env.example**

In `apps/api/.env.example`, add after the pro price lines:

```
STRIPE_PRICE_ID_TEAM_MONTHLY=price_...
STRIPE_PRICE_ID_TEAM_ANNUAL=price_...
```

- [ ] **Step 5: Run tests to verify nothing breaks**

Run: `pnpm --filter @foxhound/api test`
Expected: All existing billing tests pass (they mock Stripe so don't need real keys).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/index.ts apps/api/src/routes/billing.ts apps/api/src/routes/billing-webhook.ts apps/api/.env.example
git commit -m "Enable billing routes and add team plan support"
```

---

### Task 3: Enforce Entitlements in Cloud Mode

**Files:**

- Modify: `apps/api/src/middleware/entitlements.ts`
- Modify: `apps/api/src/middleware/entitlements.test.ts`

Currently `requireEntitlement` is a pass-through for self-hosted mode. For cloud, it needs to actually check entitlements.

- [ ] **Step 1: Update entitlements.test.ts with cloud mode tests**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@foxhound/billing", () => ({
  getEntitlements: vi.fn(),
}));

import { getEntitlements } from "@foxhound/billing";
import { requireEntitlement } from "./entitlements.js";

function mockRequest(orgId: string) {
  return { orgId } as import("fastify").FastifyRequest;
}

function mockReply() {
  const reply = {
    code: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  } as unknown as import("fastify").FastifyReply;
  return reply;
}

describe("requireEntitlement", () => {
  const originalEnv = process.env["FOXHOUND_CLOUD"];

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env["FOXHOUND_CLOUD"];
    } else {
      process.env["FOXHOUND_CLOUD"] = originalEnv;
    }
    vi.clearAllMocks();
  });

  it("passes through in self-hosted mode (no FOXHOUND_CLOUD)", async () => {
    delete process.env["FOXHOUND_CLOUD"];
    const handler = requireEntitlement("canReplay");
    const reply = mockReply();

    await handler(mockRequest("org_1"), reply);

    expect(reply.code).not.toHaveBeenCalled();
  });

  it("allows access when entitlement is granted in cloud mode", async () => {
    process.env["FOXHOUND_CLOUD"] = "1";
    vi.mocked(getEntitlements).mockResolvedValue({
      canReplay: true,
      canRunDiff: true,
      canAuditLog: false,
      maxSpans: 100_000,
      maxProjects: -1,
      maxSeats: -1,
      retentionDays: 30,
    });

    const handler = requireEntitlement("canReplay");
    const reply = mockReply();

    await handler(mockRequest("org_1"), reply);

    expect(reply.code).not.toHaveBeenCalled();
  });

  it("returns 403 when entitlement is denied in cloud mode", async () => {
    process.env["FOXHOUND_CLOUD"] = "1";
    vi.mocked(getEntitlements).mockResolvedValue({
      canReplay: false,
      canRunDiff: false,
      canAuditLog: false,
      maxSpans: 100_000,
      maxProjects: -1,
      maxSeats: -1,
      retentionDays: 30,
    });

    const handler = requireEntitlement("canAuditLog");
    const reply = mockReply();

    await handler(mockRequest("org_1"), reply);

    expect(reply.code).toHaveBeenCalledWith(403);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @foxhound/api test -- src/middleware/entitlements.test.ts`
Expected: FAIL — the cloud mode enforcement doesn't exist yet.

- [ ] **Step 3: Implement cloud mode in requireEntitlement**

```typescript
import type { FastifyRequest, FastifyReply } from "fastify";
import type { Entitlements } from "@foxhound/billing";
import { getEntitlements } from "@foxhound/billing";

type BooleanEntitlementKey = {
  [K in keyof Entitlements]: Entitlements[K] extends boolean ? K : never;
}[keyof Entitlements];

/**
 * Returns a Fastify preHandler that gates the route on a boolean entitlement.
 * Self-hosted: pass-through (all features available).
 * Cloud (FOXHOUND_CLOUD=1): checks the org's plan entitlements.
 */
export function requireEntitlement(feature: BooleanEntitlementKey) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!process.env["FOXHOUND_CLOUD"]) return;

    const entitlements = await getEntitlements(request.orgId);
    if (!entitlements[feature]) {
      return reply.code(403).send({
        error: "Forbidden",
        message: `Your plan does not include the "${feature}" feature. Upgrade at /billing.`,
      });
    }
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @foxhound/api test -- src/middleware/entitlements.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/middleware/entitlements.ts apps/api/src/middleware/entitlements.test.ts
git commit -m "Enforce entitlements in cloud mode via FOXHOUND_CLOUD env"
```

---

### Task 4: Add Billing Methods to API Client

**Files:**

- Modify: `packages/api-client/src/types.ts`
- Modify: `packages/api-client/src/index.ts`

- [ ] **Step 1: Add billing types to api-client/types.ts**

Add after the `UsageResponse` interface:

```typescript
// ── Billing ────────────────────────────────────────────────────────────────

export type CheckoutPlan = "pro_monthly" | "pro_annual" | "team_monthly" | "team_annual";

export interface CheckoutResponse {
  url: string;
}

export interface PortalResponse {
  url: string;
}

export interface BillingStatusResponse {
  plan: string;
  period: string;
  spanCount: number;
  nextBillingDate: string | null;
}
```

- [ ] **Step 2: Add billing methods to FoxhoundApiClient**

In `packages/api-client/src/index.ts`, add after the `getUsage()` method and before `// ── HTTP helpers`:

```typescript
// ── Billing ──────────────────────────────────────────────────────────────

async createCheckout(params: {
  plan: import("./types.js").CheckoutPlan;
  successUrl: string;
  cancelUrl: string;
}): Promise<import("./types.js").CheckoutResponse> {
  return this.post("/v1/billing/checkout", params as unknown as Record<string, unknown>);
}

async createPortalSession(returnUrl: string): Promise<import("./types.js").PortalResponse> {
  return this.post("/v1/billing/portal", { returnUrl });
}

async getBillingStatus(): Promise<import("./types.js").BillingStatusResponse> {
  return this.get("/v1/billing/status");
}
```

- [ ] **Step 3: Verify typecheck passes**

Run: `pnpm --filter @foxhound/api-client typecheck`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add packages/api-client/src/types.ts packages/api-client/src/index.ts
git commit -m "Add billing methods to API client"
```

---

### Task 5: Create Dockerfile for API Server

**Files:**

- Create: `Dockerfile`
- Create: `.dockerignore`

- [ ] **Step 1: Create .dockerignore**

```
node_modules
.git
dist
*.md
.env*
.github
docs
coverage
.turbo
packages/sdk-py
```

- [ ] **Step 2: Create multi-stage Dockerfile**

```dockerfile
# ── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-slim AS builder

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /app

# Copy workspace config first for layer caching
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json turbo.json ./

# Copy only the packages needed for the API server
COPY apps/api/package.json apps/api/
COPY packages/db/package.json packages/db/
COPY packages/billing/package.json packages/billing/
COPY packages/types/package.json packages/types/
COPY packages/notifications/package.json packages/notifications/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY apps/api/ apps/api/
COPY packages/db/ packages/db/
COPY packages/billing/ packages/billing/
COPY packages/types/ packages/types/
COPY packages/notifications/ packages/notifications/
COPY tsconfig.base.json ./

# Build all packages
RUN pnpm build

# Prune dev dependencies
RUN pnpm prune --prod

# ── Runtime stage ────────────────────────────────────────────────────────────
FROM node:20-slim AS runtime

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

WORKDIR /app

# Copy built artifacts and production dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/db/package.json ./packages/db/
COPY --from=builder /app/packages/billing/dist ./packages/billing/dist
COPY --from=builder /app/packages/billing/package.json ./packages/billing/
COPY --from=builder /app/packages/types/dist ./packages/types/dist
COPY --from=builder /app/packages/types/package.json ./packages/types/
COPY --from=builder /app/packages/notifications/dist ./packages/notifications/dist
COPY --from=builder /app/packages/notifications/package.json ./packages/notifications/
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./

# Copy drizzle migrations for runtime migration
COPY --from=builder /app/packages/db/drizzle ./packages/db/drizzle

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:3001/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "apps/api/dist/index.js"]
```

- [ ] **Step 3: Verify the Docker build works**

Run: `docker build -t foxhound-api .`
Expected: Build succeeds. (If it fails due to missing drizzle directory or similar, adjust COPY paths.)

- [ ] **Step 4: Commit**

```bash
git add Dockerfile .dockerignore
git commit -m "Add multi-stage Dockerfile for API server"
```

---

### Task 6: Create Fly.io Configuration

**Files:**

- Create: `fly.toml`
- Modify: `apps/api/.env.example`

- [ ] **Step 1: Create fly.toml**

```toml
app = "foxhound-api"
primary_region = "iad"

[build]

[env]
  PORT = "3001"
  HOST = "0.0.0.0"
  LOG_LEVEL = "info"
  NODE_ENV = "production"
  FOXHOUND_CLOUD = "1"

[http_service]
  internal_port = 3001
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 1

  [http_service.concurrency]
    type = "requests"
    hard_limit = 250
    soft_limit = 200

[[http_service.checks]]
  grace_period = "10s"
  interval = "30s"
  method = "GET"
  path = "/health"
  timeout = "5s"

[metrics]
  port = 9091
  path = "/metrics"
```

- [ ] **Step 2: Update .env.example with cloud-specific vars**

Add the following to `apps/api/.env.example`:

```
# Cloud deployment
FOXHOUND_CLOUD=
# Neon Postgres (used in cloud — overrides DATABASE_URL)
# DATABASE_URL=postgresql://...@ep-xxx.us-east-2.aws.neon.tech/foxhound?sslmode=require
# Upstash Redis (optional — for distributed rate limiting)
UPSTASH_REDIS_URL=
UPSTASH_REDIS_TOKEN=
# Stripe team plan prices
STRIPE_PRICE_ID_TEAM_MONTHLY=price_...
STRIPE_PRICE_ID_TEAM_ANNUAL=price_...
```

- [ ] **Step 3: Commit**

```bash
git add fly.toml apps/api/.env.example
git commit -m "Add Fly.io configuration and cloud env vars"
```

---

### Task 7: Create Deploy Workflow

**Files:**

- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create the deploy workflow**

```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

env:
  FLY_API_TOKEN: ${{ secrets.FLY_API_TOKEN }}

jobs:
  test:
    name: Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v3
        with:
          version: "9"

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "pnpm"

      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm test

  deploy:
    name: Deploy to Fly.io
    runs-on: ubuntu-latest
    needs: [test]
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4

      - uses: superfly/flyctl-actions/setup-flyctl@master

      - run: flyctl deploy --remote-only
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "Add Fly.io deploy workflow on push to main"
```

---

### Task 8: Create `foxhound init` CLI Command

**Files:**

- Create: `packages/cli/src/commands/init.ts`
- Modify: `packages/cli/src/index.ts`

- [ ] **Step 1: Create the init command**

```typescript
import type { Command } from "commander";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import chalk from "chalk";

interface DetectedFramework {
  name: string;
  integration: string;
  language: "python" | "typescript";
}

function detectFramework(cwd: string): DetectedFramework | null {
  // Check Python frameworks
  const pyFiles = ["requirements.txt", "pyproject.toml", "Pipfile"];
  for (const f of pyFiles) {
    const path = join(cwd, f);
    if (!existsSync(path)) continue;
    const content = readFileSync(path, "utf-8");

    if (content.includes("langgraph")) {
      return { name: "LangGraph", integration: "langgraph", language: "python" };
    }
    if (content.includes("crewai")) {
      return { name: "CrewAI", integration: "crewai", language: "python" };
    }
    if (content.includes("autogen")) {
      return { name: "AutoGen", integration: "autogen", language: "python" };
    }
    if (content.includes("openai-agents") || content.includes("openai_agents")) {
      return { name: "OpenAI Agents", integration: "openai_agents", language: "python" };
    }
    if (content.includes("anthropic")) {
      return { name: "Claude Agent SDK", integration: "claude_agent", language: "python" };
    }
  }

  // Check TypeScript/Node frameworks
  const pkgPath = join(cwd, "package.json");
  if (existsSync(pkgPath)) {
    const pkg = readFileSync(pkgPath, "utf-8");
    if (pkg.includes("@anthropic-ai/sdk")) {
      return { name: "Claude Agent SDK", integration: "claude-agent", language: "typescript" };
    }
  }

  return null;
}

function pythonSnippet(framework: DetectedFramework, apiKey: string, endpoint: string): string {
  const base = `from foxhound import FoxhoundClient

fox = FoxhoundClient(
    api_key="${apiKey}",
    endpoint="${endpoint}",
)`;

  if (framework.integration === "langgraph") {
    return `${base}

from foxhound.integrations.langgraph import FoxhoundLangGraphHandler

# Add to your LangGraph app:
handler = FoxhoundLangGraphHandler(fox)
# app.invoke(inputs, config={"callbacks": [handler]})
`;
  }
  if (framework.integration === "crewai") {
    return `${base}

from foxhound.integrations.crewai import FoxhoundCrewHandler

# Add to your CrewAI crew:
handler = FoxhoundCrewHandler(fox)
# crew = Crew(..., callbacks=[handler])
`;
  }

  return `${base}

# Start a trace:
# with fox.start_trace(agent_id="my-agent") as trace:
#     with trace.start_span("my-step", kind="agent_step") as span:
#         span.set_attribute("input", "hello")
`;
}

function typescriptSnippet(framework: DetectedFramework, apiKey: string, endpoint: string): string {
  const base = `import { FoxhoundClient } from "@foxhound-ai/sdk";

const fox = new FoxhoundClient({
  apiKey: "${apiKey}",
  endpoint: "${endpoint}",
});`;

  if (framework.integration === "claude-agent") {
    return `${base}

import { withFoxhound } from "@foxhound-ai/sdk/integrations/claude-agent";

// Wrap your agent's tools:
// const tracedTools = withFoxhound(fox, tools);
`;
  }

  return `${base}

// Start a trace:
// const trace = fox.startTrace("my-agent");
// const span = trace.startSpan("my-step", "agent_step");
// span.end();
// await trace.flush();
`;
}

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Initialize Foxhound in the current project")
    .option("--api-key <key>", "API key (or set FOXHOUND_API_KEY)")
    .option("--endpoint <url>", "API endpoint", "https://api.foxhound.dev")
    .action(async (opts: { apiKey?: string; endpoint: string }) => {
      const cwd = resolve(".");
      console.log(chalk.bold("Foxhound Init\n"));

      // 1. Detect framework
      const framework = detectFramework(cwd);
      if (framework) {
        console.log(`Detected: ${chalk.cyan(framework.name)} (${framework.language})\n`);
      } else {
        console.log("No known framework detected. Generating generic setup.\n");
      }

      // 2. Get API key
      let apiKey = opts.apiKey ?? process.env["FOXHOUND_API_KEY"] ?? "";
      if (!apiKey) {
        const rl = createInterface({ input: stdin, output: stdout });
        console.log("Get your API key at https://app.foxhound.dev/settings/api-keys\n");
        apiKey = await rl.question("API key: ");
        rl.close();
      }
      if (!apiKey) {
        console.error(chalk.red("No API key provided. Aborting."));
        process.exit(1);
      }

      // 3. Generate snippet
      const detected = framework ?? {
        name: "Generic",
        integration: "generic",
        language: "python" as const,
      };
      const snippet =
        detected.language === "python"
          ? pythonSnippet(detected, apiKey, opts.endpoint)
          : typescriptSnippet(detected, apiKey, opts.endpoint);

      // 4. Write snippet file
      const ext = detected.language === "python" ? "py" : "ts";
      const filename = `foxhound_setup.${ext}`;
      const filepath = join(cwd, filename);

      if (existsSync(filepath)) {
        console.log(chalk.yellow(`${filename} already exists — printing snippet instead:\n`));
        console.log(snippet);
      } else {
        writeFileSync(filepath, snippet);
        console.log(`Created ${chalk.green(filename)}\n`);
        console.log(snippet);
      }

      console.log(chalk.dim("─".repeat(60)));
      console.log(`\nNext: import ${chalk.cyan(filename)} in your agent code and run it.`);
      console.log("Your first trace should appear at https://app.foxhound.dev within seconds.\n");
    });
}
```

- [ ] **Step 2: Register the init command in CLI index.ts**

In `packages/cli/src/index.ts`, add the import and registration:

```typescript
import { registerInitCommand } from "./commands/init.js";
```

And add after the existing command registrations:

```typescript
registerInitCommand(program);
```

- [ ] **Step 3: Verify typecheck passes**

Run: `pnpm --filter @foxhound-ai/cli typecheck`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/commands/init.ts packages/cli/src/index.ts
git commit -m "Add foxhound init command with framework auto-detection"
```

---

### Task 9: Generate Database Migration for Team Plan

**Files:**

- Drizzle migration (auto-generated)

Since we changed the `plan` column enum to include "team", we need a migration.

- [ ] **Step 1: Generate the migration**

Run: `pnpm --filter @foxhound/db db:generate`

This uses Drizzle Kit to generate a SQL migration file in `packages/db/drizzle/`.

- [ ] **Step 2: Review the generated migration**

Check the generated SQL — it should add "team" to the plan enum type. If Drizzle uses a text column (not a native enum), the migration may be a no-op since the enum constraint is application-level only.

- [ ] **Step 3: Run the full test suite**

Run: `pnpm test`
Expected: All tests pass across the monorepo.

- [ ] **Step 4: Run lint and format**

Run: `pnpm lint && pnpm format:check`
Expected: Clean.

- [ ] **Step 5: Commit**

```bash
git add packages/db/drizzle/
git commit -m "Add database migration for team plan enum"
```

---

### Task 10: Final Verification

- [ ] **Step 1: Run the full build**

Run: `pnpm build`
Expected: All packages build successfully.

- [ ] **Step 2: Run the full test suite**

Run: `pnpm test`
Expected: All tests pass.

- [ ] **Step 3: Run lint and typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: Clean.

- [ ] **Step 4: Verify Docker build**

Run: `docker build -t foxhound-api .`
Expected: Image builds successfully.

- [ ] **Step 5: Run the container locally to smoke test**

Run: `docker run --rm -e DATABASE_URL=postgresql://foxhound:foxhound@host.docker.internal:5432/foxhound_dev -e JWT_SECRET=test-secret -e LOG_LEVEL=info -p 3001:3001 foxhound-api`

Then in another terminal:
Run: `curl http://localhost:3001/health`
Expected: `{"status":"ok","version":"0.0.1"}`

Run: `curl http://localhost:3001/v1/billing/usage`
Expected: 401 (requires auth — proves the route is registered and active).

---

## Post-Implementation Notes

After this plan is executed, Phase 1 code changes are complete. The remaining Phase 1 steps require manual/ops work:

1. **Fly.io setup:** `fly launch` (imports fly.toml), `fly secrets set DATABASE_URL=... JWT_SECRET=... STRIPE_SECRET_KEY=...`
2. **Neon Postgres:** Create a database at neon.tech, get connection string
3. **Stripe setup:** Create products/prices in Stripe Dashboard, copy price IDs to Fly secrets
4. **Stripe webhook:** Configure `https://foxhound-api.fly.dev/v1/billing/webhooks` in Stripe
5. **DNS:** Point `api.foxhound.dev` to the Fly.io app
6. **First deploy:** `fly deploy` or push to main (workflow handles it)
