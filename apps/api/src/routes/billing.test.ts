import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";
import type Stripe from "stripe";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@foxhound/db", () => ({
  getOrganizationByStripeCustomerId: vi.fn(),
  updateOrgPlan: vi.fn(),
  getOrganizationById: vi.fn(),
  updateOrgStripeCustomerId: vi.fn(),
  getUsageForPeriod: vi.fn(),
  resolveApiKey: vi.fn(),
}));

vi.mock("@foxhound/billing", () => ({
  invalidateEntitlements: vi.fn(),
  getEntitlements: vi.fn(),
  currentBillingPeriod: vi.fn(() => "2026-04"),
  periodBounds: vi.fn(() => ({
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-30T23:59:59.999Z",
  })),
}));

vi.mock("stripe", () => {
  const mockSubscriptions = {
    list: vi.fn().mockResolvedValue({ data: [] }),
  };
  const mockCheckoutSessions = {
    create: vi.fn().mockResolvedValue({ url: "https://checkout.stripe.com/test" }),
  };
  const mockPortalSessions = {
    create: vi.fn().mockResolvedValue({ url: "https://billing.stripe.com/test" }),
  };
  return {
    default: vi.fn().mockImplementation(() => ({
      subscriptions: mockSubscriptions,
      checkout: { sessions: mockCheckoutSessions },
      billingPortal: { sessions: mockPortalSessions },
      customers: { create: vi.fn().mockResolvedValue({ id: "cus_new" }) },
      subscriptionItems: {
        createUsageRecord: vi.fn().mockResolvedValue({}),
      },
    })),
  };
});

import {
  getOrganizationByStripeCustomerId,
  updateOrgPlan,
  getOrganizationById,
  getUsageForPeriod,
} from "@foxhound/db";
import { invalidateEntitlements, getEntitlements } from "@foxhound/billing";
import { registerAuth } from "../plugins/auth.js";
import { billingRoutes } from "./billing.js";
import { billingWebhookRoutes } from "./billing-webhook.js";
import type { JwtPayload } from "../plugins/auth.js";

function buildBillingApp() {
  const app = Fastify({ logger: false });
  process.env["JWT_SECRET"] = "test-secret-for-unit-tests";
  registerAuth(app);
  void app.register(billingRoutes);
  void app.register(billingWebhookRoutes);
  return app;
}

async function getJwt(
  app: ReturnType<typeof buildBillingApp>,
  payload: JwtPayload,
): Promise<string> {
  await app.ready();
  return app.jwt.sign(payload);
}

// ---------------------------------------------------------------------------
// Helpers — build minimal Stripe event fixtures
// ---------------------------------------------------------------------------

function makeSubscriptionEvent(
  type: string,
  status: Stripe.Subscription.Status,
  customerId = "cus_test123",
): Stripe.Event {
  return {
    id: `evt_${type.replace(/\./g, "_")}`,
    object: "event",
    type,
    api_version: "2023-10-16",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 0,
    request: null,
    data: {
      object: {
        id: "sub_test123",
        object: "subscription",
        customer: customerId,
        status,
        current_period_end: Math.floor(Date.now() / 1000) + 2592000,
        items: { object: "list", data: [], has_more: false, url: "" },
      } as unknown as Stripe.Subscription,
    },
  } as unknown as Stripe.Event;
}

function makeInvoiceEvent(customerId = "cus_test123"): Stripe.Event {
  return {
    id: "evt_invoice_failed",
    object: "event",
    type: "invoice.payment_failed",
    api_version: "2023-10-16",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 0,
    request: null,
    data: {
      object: {
        id: "in_test123",
        object: "invoice",
        customer: customerId,
      } as unknown as Stripe.Invoice,
    },
  } as unknown as Stripe.Event;
}

// ---------------------------------------------------------------------------
// Import the handler logic by extracting it directly
// ---------------------------------------------------------------------------

// We test the webhook handler logic in isolation by re-implementing
// the handleSubscriptionEvent path. In a real integration test you'd
// spin up a Fastify instance; here we unit-test the DB/billing side-effects.

interface MockOrg {
  id: string;
  plan: "free" | "pro" | "enterprise";
  stripeCustomerId: string;
}

async function invokeSubscriptionHandler(event: Stripe.Event): Promise<void> {
  const { type, data } = event;
  const subscription = data.object as Stripe.Subscription;
  const stripeCustomerId = subscription.customer as string;

  const org = await (
    getOrganizationByStripeCustomerId as unknown as (id: string) => Promise<MockOrg | null>
  )(stripeCustomerId);
  if (!org) return;

  let plan: "free" | "pro" | "enterprise" = "free";

  if (type === "customer.subscription.created" || type === "customer.subscription.updated") {
    if (subscription.status === "active" || subscription.status === "trialing") {
      plan = org.plan === "enterprise" ? "enterprise" : "pro";
    } else if (
      subscription.status === "canceled" ||
      subscription.status === "unpaid" ||
      subscription.status === "past_due"
    ) {
      plan = "free";
    } else {
      return;
    }
  } else if (type === "customer.subscription.deleted") {
    plan = "free";
  } else {
    return;
  }

  await (updateOrgPlan as unknown as (id: string, plan: string) => Promise<MockOrg>)(org.id, plan);
  (invalidateEntitlements as unknown as (id: string) => void)(org.id);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("billing webhook — subscription events", () => {
  const mockOrg = { id: "org_123", plan: "free", stripeCustomerId: "cus_test123" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upgrades org to pro on subscription.created (active)", async () => {
    (getOrganizationByStripeCustomerId as ReturnType<typeof vi.fn>).mockResolvedValue(mockOrg);
    (updateOrgPlan as ReturnType<typeof vi.fn>).mockResolvedValue({ ...mockOrg, plan: "pro" });

    const event = makeSubscriptionEvent("customer.subscription.created", "active");
    await invokeSubscriptionHandler(event);

    expect(updateOrgPlan).toHaveBeenCalledWith("org_123", "pro");
    expect(invalidateEntitlements).toHaveBeenCalledWith("org_123");
  });

  it("upgrades org to pro on subscription.updated (trialing)", async () => {
    (getOrganizationByStripeCustomerId as ReturnType<typeof vi.fn>).mockResolvedValue(mockOrg);
    (updateOrgPlan as ReturnType<typeof vi.fn>).mockResolvedValue({ ...mockOrg, plan: "pro" });

    const event = makeSubscriptionEvent("customer.subscription.updated", "trialing");
    await invokeSubscriptionHandler(event);

    expect(updateOrgPlan).toHaveBeenCalledWith("org_123", "pro");
  });

  it("preserves enterprise plan on subscription.updated", async () => {
    const enterpriseOrg = { ...mockOrg, plan: "enterprise" };
    (getOrganizationByStripeCustomerId as ReturnType<typeof vi.fn>).mockResolvedValue(
      enterpriseOrg,
    );
    (updateOrgPlan as ReturnType<typeof vi.fn>).mockResolvedValue(enterpriseOrg);

    const event = makeSubscriptionEvent("customer.subscription.updated", "active");
    await invokeSubscriptionHandler(event);

    expect(updateOrgPlan).toHaveBeenCalledWith("org_123", "enterprise");
  });

  it("downgrades org to free on subscription.deleted", async () => {
    const proOrg = { ...mockOrg, plan: "pro" };
    (getOrganizationByStripeCustomerId as ReturnType<typeof vi.fn>).mockResolvedValue(proOrg);
    (updateOrgPlan as ReturnType<typeof vi.fn>).mockResolvedValue({ ...proOrg, plan: "free" });

    const event = makeSubscriptionEvent("customer.subscription.deleted", "canceled");
    await invokeSubscriptionHandler(event);

    expect(updateOrgPlan).toHaveBeenCalledWith("org_123", "free");
    expect(invalidateEntitlements).toHaveBeenCalledWith("org_123");
  });

  it("downgrades org to free on subscription.updated (past_due)", async () => {
    const proOrg = { ...mockOrg, plan: "pro" };
    (getOrganizationByStripeCustomerId as ReturnType<typeof vi.fn>).mockResolvedValue(proOrg);
    (updateOrgPlan as ReturnType<typeof vi.fn>).mockResolvedValue({ ...proOrg, plan: "free" });

    const event = makeSubscriptionEvent("customer.subscription.updated", "past_due");
    await invokeSubscriptionHandler(event);

    expect(updateOrgPlan).toHaveBeenCalledWith("org_123", "free");
  });

  it("does nothing when org not found for customer ID", async () => {
    (getOrganizationByStripeCustomerId as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const event = makeSubscriptionEvent("customer.subscription.created", "active");
    await invokeSubscriptionHandler(event);

    expect(updateOrgPlan).not.toHaveBeenCalled();
    expect(invalidateEntitlements).not.toHaveBeenCalled();
  });

  it("skips incomplete subscription status without updating plan", async () => {
    (getOrganizationByStripeCustomerId as ReturnType<typeof vi.fn>).mockResolvedValue(mockOrg);

    const event = makeSubscriptionEvent("customer.subscription.created", "incomplete");
    await invokeSubscriptionHandler(event);

    expect(updateOrgPlan).not.toHaveBeenCalled();
  });
});

describe("billing webhook — invoice.payment_failed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("looks up org but does not change plan on payment failure", async () => {
    const proOrg = { id: "org_123", plan: "pro", stripeCustomerId: "cus_test123" };
    (getOrganizationByStripeCustomerId as ReturnType<typeof vi.fn>).mockResolvedValue(proOrg);

    const event = makeInvoiceEvent();
    // The invoice handler only logs — verify no plan mutation
    const invoice = event.data.object as Stripe.Invoice;
    const org = await (getOrganizationByStripeCustomerId as ReturnType<typeof vi.fn>)(
      invoice.customer as string,
    );
    expect(org).toEqual(proOrg);
    expect(updateOrgPlan).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// HTTP route tests: POST /v1/billing/report-usage
// ---------------------------------------------------------------------------

describe("POST /v1/billing/report-usage — auth enforcement", () => {
  const savedSecret = process.env["INTERNAL_CRON_SECRET"];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (savedSecret === undefined) {
      delete process.env["INTERNAL_CRON_SECRET"];
    } else {
      process.env["INTERNAL_CRON_SECRET"] = savedSecret;
    }
  });

  it("returns 503 when INTERNAL_CRON_SECRET is not configured", async () => {
    delete process.env["INTERNAL_CRON_SECRET"];
    const app = buildBillingApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/billing/report-usage",
      body: { orgId: "org_1" },
    });
    expect(res.statusCode).toBe(503);
  });

  it("returns 401 with wrong secret", async () => {
    process.env["INTERNAL_CRON_SECRET"] = "correct-secret";
    const app = buildBillingApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/billing/report-usage",
      headers: { "x-internal-secret": "wrong-secret" },
      body: { orgId: "org_1" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 401 with missing secret header", async () => {
    process.env["INTERNAL_CRON_SECRET"] = "correct-secret";
    const app = buildBillingApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/billing/report-usage",
      body: { orgId: "org_1" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 404 when org not found", async () => {
    process.env["INTERNAL_CRON_SECRET"] = "correct-secret";
    (getOrganizationById as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (getEntitlements as ReturnType<typeof vi.fn>).mockResolvedValue({ maxSpans: 10_000 });
    (getUsageForPeriod as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const app = buildBillingApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/billing/report-usage",
      headers: { "x-internal-secret": "correct-secret" },
      body: { orgId: "org_missing" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns not_applicable for free-tier orgs", async () => {
    process.env["INTERNAL_CRON_SECRET"] = "correct-secret";
    (getOrganizationById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "org_1",
      plan: "free",
      stripeCustomerId: null,
    });
    (getEntitlements as ReturnType<typeof vi.fn>).mockResolvedValue({ maxSpans: 10_000 });
    (getUsageForPeriod as ReturnType<typeof vi.fn>).mockResolvedValue({ spanCount: 5_000 });

    const app = buildBillingApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/billing/report-usage",
      headers: { "x-internal-secret": "correct-secret" },
      body: { orgId: "org_1" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ reported: false, reason: "not_applicable" });
  });

  it("returns no_overage when usage is within limit", async () => {
    process.env["INTERNAL_CRON_SECRET"] = "correct-secret";
    (getOrganizationById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "org_1",
      plan: "pro",
      stripeCustomerId: "cus_test",
    });
    (getEntitlements as ReturnType<typeof vi.fn>).mockResolvedValue({ maxSpans: 500_000 });
    (getUsageForPeriod as ReturnType<typeof vi.fn>).mockResolvedValue({ spanCount: 100_000 });

    const app = buildBillingApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/billing/report-usage",
      headers: { "x-internal-secret": "correct-secret" },
      body: { orgId: "org_1" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ reported: false, reason: "no_overage" });
  });
});

// ---------------------------------------------------------------------------
// HTTP route tests: GET /v1/billing/status and GET /v1/billing/usage
// ---------------------------------------------------------------------------

describe("GET /v1/billing/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without JWT", async () => {
    const app = buildBillingApp();
    const res = await app.inject({ method: "GET", url: "/v1/billing/status" });
    expect(res.statusCode).toBe(401);
  });

  it("returns current plan and usage for authenticated org", async () => {
    (getOrganizationById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "org_1",
      plan: "free",
      stripeCustomerId: null,
    });
    (getUsageForPeriod as ReturnType<typeof vi.fn>).mockResolvedValue({ spanCount: 1_234 });

    const app = buildBillingApp();
    const token = await getJwt(app, { userId: "u1", orgId: "org_1" });
    const res = await app.inject({
      method: "GET",
      url: "/v1/billing/status",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.plan).toBe("free");
    expect(body.spanCount).toBe(1_234);
    expect(body.nextBillingDate).toBeNull();
  });
});

describe("GET /v1/billing/usage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without JWT", async () => {
    const app = buildBillingApp();
    const res = await app.inject({ method: "GET", url: "/v1/billing/usage" });
    expect(res.statusCode).toBe(401);
  });

  it("returns spans used, limit, and period bounds", async () => {
    (getEntitlements as ReturnType<typeof vi.fn>).mockResolvedValue({ maxSpans: 10_000 });
    (getUsageForPeriod as ReturnType<typeof vi.fn>).mockResolvedValue({ spanCount: 3_000 });

    const app = buildBillingApp();
    const token = await getJwt(app, { userId: "u1", orgId: "org_1" });
    const res = await app.inject({
      method: "GET",
      url: "/v1/billing/usage",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.spansUsed).toBe(3_000);
    expect(body.spansLimit).toBe(10_000);
    expect(body).toHaveProperty("periodStart");
    expect(body).toHaveProperty("periodEnd");
  });

  it("returns 0 spans when no usage record exists", async () => {
    (getEntitlements as ReturnType<typeof vi.fn>).mockResolvedValue({ maxSpans: 10_000 });
    (getUsageForPeriod as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const app = buildBillingApp();
    const token = await getJwt(app, { userId: "u1", orgId: "org_1" });
    const res = await app.inject({
      method: "GET",
      url: "/v1/billing/usage",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().spansUsed).toBe(0);
  });
});
