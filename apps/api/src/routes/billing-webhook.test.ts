import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Fastify from "fastify";
import type Stripe from "stripe";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@foxhound/db", () => ({
  resolveApiKey: vi.fn(),
  touchApiKeyLastUsed: vi.fn().mockResolvedValue(undefined),
  updateOrgPlan: vi.fn().mockResolvedValue(undefined),
  getOrganizationByStripeCustomerId: vi.fn(),
  writeAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@foxhound/billing", () => ({
  getEntitlements: vi.fn(),
  invalidateEntitlements: vi.fn(),
}));

vi.mock("./billing.js", () => ({
  invalidateBillingStatusCache: vi.fn(),
}));

// Store a reference to constructEvent so tests can override its behavior.
const mockConstructEvent = vi.fn();

vi.mock("stripe", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      webhooks: {
        constructEvent: mockConstructEvent,
      },
    })),
  };
});

import { getOrganizationByStripeCustomerId, updateOrgPlan, writeAuditLog } from "@foxhound/db";
import { invalidateEntitlements } from "@foxhound/billing";
import { invalidateBillingStatusCache } from "./billing.js";
import { registerAuth } from "../plugins/auth.js";
import { billingWebhookRoutes } from "./billing-webhook.js";

// ---------------------------------------------------------------------------
// App builder
// ---------------------------------------------------------------------------

function buildApp() {
  const app = Fastify({ logger: false });
  process.env["JWT_SECRET"] = "test-secret-for-unit-tests";
  registerAuth(app);
  void app.register(billingWebhookRoutes);
  return app;
}

// ---------------------------------------------------------------------------
// Stripe event fixture helpers
// ---------------------------------------------------------------------------

function makeSubscriptionEvent(
  type: string,
  status: Stripe.Subscription.Status,
  customerId = "cus_test123",
  priceId?: string,
): Stripe.Event {
  const items = priceId ? [{ price: { id: priceId } }] : [];
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
        current_period_end: Math.floor(Date.now() / 1000) + 2_592_000,
        items: { object: "list", data: items, has_more: false, url: "" },
      } as unknown as Stripe.Subscription,
    },
  } as unknown as Stripe.Event;
}

function makeInvoiceEvent(customerId = "cus_test123"): Stripe.Event {
  return {
    id: "evt_invoice_payment_failed",
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

function makeUnhandledEvent(): Stripe.Event {
  return {
    id: "evt_unhandled",
    object: "event",
    type: "charge.succeeded",
    api_version: "2023-10-16",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 0,
    request: null,
    data: { object: {} },
  } as unknown as Stripe.Event;
}

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const MOCK_ORG = { id: "org_123", plan: "free", stripeCustomerId: "cus_test123" };

const WEBHOOK_HEADERS = {
  "content-type": "application/json",
  "stripe-signature": "t=1234567890,v1=valid_signature",
} as const;

// ---------------------------------------------------------------------------
// Env var lifecycle
// ---------------------------------------------------------------------------

const savedStripeKey = process.env["STRIPE_SECRET_KEY"];
const savedWebhookSecret = process.env["STRIPE_WEBHOOK_SECRET"];

function restoreEnv(): void {
  if (savedStripeKey === undefined) {
    delete process.env["STRIPE_SECRET_KEY"];
  } else {
    process.env["STRIPE_SECRET_KEY"] = savedStripeKey;
  }
  if (savedWebhookSecret === undefined) {
    delete process.env["STRIPE_WEBHOOK_SECRET"];
  } else {
    process.env["STRIPE_WEBHOOK_SECRET"] = savedWebhookSecret;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /v1/billing/webhooks — signature validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env["STRIPE_SECRET_KEY"] = "sk_test_fake";
    process.env["STRIPE_WEBHOOK_SECRET"] = "whsec_test_fake";
  });

  afterEach(() => {
    restoreEnv();
  });

  it("returns 400 when stripe-signature header is missing", async () => {
    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/billing/webhooks",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "customer.subscription.created" }),
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({
      error: "Bad Request",
      message: "Missing Stripe-Signature",
    });
    expect(mockConstructEvent).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid/tampered stripe-signature", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("No signatures found matching the expected signature for payload.");
    });

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/billing/webhooks",
      headers: {
        "content-type": "application/json",
        "stripe-signature": "t=1234567890,v1=tampered_value",
      },
      body: JSON.stringify({ type: "customer.subscription.created" }),
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({
      error: "Bad Request",
      message: "Invalid webhook signature",
    });
    expect(mockConstructEvent).toHaveBeenCalledOnce();
  });

  it("returns 503 when STRIPE_SECRET_KEY is not configured", async () => {
    delete process.env["STRIPE_SECRET_KEY"];

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/billing/webhooks",
      headers: { ...WEBHOOK_HEADERS },
      body: JSON.stringify({ type: "test" }),
    });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({
      error: "Service Unavailable",
      message: "Billing not configured",
    });
  });

  it("returns 503 when STRIPE_WEBHOOK_SECRET is not configured", async () => {
    delete process.env["STRIPE_WEBHOOK_SECRET"];

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/billing/webhooks",
      headers: { ...WEBHOOK_HEADERS },
      body: JSON.stringify({ type: "test" }),
    });

    expect(res.statusCode).toBe(503);
    expect(res.json()).toMatchObject({
      error: "Service Unavailable",
      message: "Billing not configured",
    });
  });
});

describe("POST /v1/billing/webhooks — subscription.created", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env["STRIPE_SECRET_KEY"] = "sk_test_fake";
    process.env["STRIPE_WEBHOOK_SECRET"] = "whsec_test_fake";
  });

  afterEach(() => {
    restoreEnv();
  });

  it("upgrades org to pro on active subscription.created", async () => {
    const event = makeSubscriptionEvent("customer.subscription.created", "active");
    mockConstructEvent.mockReturnValue(event);
    (getOrganizationByStripeCustomerId as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...MOCK_ORG,
    });

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/billing/webhooks",
      headers: { ...WEBHOOK_HEADERS },
      body: JSON.stringify(event),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ received: true });
    expect(updateOrgPlan).toHaveBeenCalledWith("org_123", "pro");
    expect(invalidateEntitlements).toHaveBeenCalledWith("org_123");
    expect(invalidateBillingStatusCache).toHaveBeenCalledWith("org_123");
  });

  it("assigns team plan when price matches STRIPE_PRICE_ID_TEAM_MONTHLY", async () => {
    process.env["STRIPE_PRICE_ID_TEAM_MONTHLY"] = "price_team_monthly";

    const event = makeSubscriptionEvent(
      "customer.subscription.created",
      "active",
      "cus_test123",
      "price_team_monthly",
    );
    mockConstructEvent.mockReturnValue(event);
    (getOrganizationByStripeCustomerId as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...MOCK_ORG,
    });

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/billing/webhooks",
      headers: { ...WEBHOOK_HEADERS },
      body: JSON.stringify(event),
    });

    expect(res.statusCode).toBe(200);
    expect(updateOrgPlan).toHaveBeenCalledWith("org_123", "team");

    delete process.env["STRIPE_PRICE_ID_TEAM_MONTHLY"];
  });

  it("assigns team plan when price matches STRIPE_PRICE_ID_TEAM_ANNUAL", async () => {
    process.env["STRIPE_PRICE_ID_TEAM_ANNUAL"] = "price_team_annual";

    const event = makeSubscriptionEvent(
      "customer.subscription.created",
      "active",
      "cus_test123",
      "price_team_annual",
    );
    mockConstructEvent.mockReturnValue(event);
    (getOrganizationByStripeCustomerId as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...MOCK_ORG,
    });

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/billing/webhooks",
      headers: { ...WEBHOOK_HEADERS },
      body: JSON.stringify(event),
    });

    expect(res.statusCode).toBe(200);
    expect(updateOrgPlan).toHaveBeenCalledWith("org_123", "team");

    delete process.env["STRIPE_PRICE_ID_TEAM_ANNUAL"];
  });

  it("preserves enterprise plan on subscription.created for enterprise org", async () => {
    const event = makeSubscriptionEvent("customer.subscription.created", "active");
    mockConstructEvent.mockReturnValue(event);
    (getOrganizationByStripeCustomerId as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...MOCK_ORG,
      plan: "enterprise",
    });

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/billing/webhooks",
      headers: { ...WEBHOOK_HEADERS },
      body: JSON.stringify(event),
    });

    expect(res.statusCode).toBe(200);
    expect(updateOrgPlan).toHaveBeenCalledWith("org_123", "enterprise");
  });

  it("does not update plan when org is not found", async () => {
    const event = makeSubscriptionEvent("customer.subscription.created", "active");
    mockConstructEvent.mockReturnValue(event);
    (getOrganizationByStripeCustomerId as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/billing/webhooks",
      headers: { ...WEBHOOK_HEADERS },
      body: JSON.stringify(event),
    });

    expect(res.statusCode).toBe(200);
    expect(updateOrgPlan).not.toHaveBeenCalled();
    expect(invalidateEntitlements).not.toHaveBeenCalled();
    expect(invalidateBillingStatusCache).not.toHaveBeenCalled();
  });

  it("skips incomplete subscription status without updating plan", async () => {
    const event = makeSubscriptionEvent("customer.subscription.created", "incomplete");
    mockConstructEvent.mockReturnValue(event);
    (getOrganizationByStripeCustomerId as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...MOCK_ORG,
    });

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/billing/webhooks",
      headers: { ...WEBHOOK_HEADERS },
      body: JSON.stringify(event),
    });

    expect(res.statusCode).toBe(200);
    expect(updateOrgPlan).not.toHaveBeenCalled();
  });
});

describe("POST /v1/billing/webhooks — subscription.updated", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env["STRIPE_SECRET_KEY"] = "sk_test_fake";
    process.env["STRIPE_WEBHOOK_SECRET"] = "whsec_test_fake";
  });

  afterEach(() => {
    restoreEnv();
  });

  it("upgrades org to pro on trialing subscription.updated", async () => {
    const event = makeSubscriptionEvent("customer.subscription.updated", "trialing");
    mockConstructEvent.mockReturnValue(event);
    (getOrganizationByStripeCustomerId as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...MOCK_ORG,
    });

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/billing/webhooks",
      headers: { ...WEBHOOK_HEADERS },
      body: JSON.stringify(event),
    });

    expect(res.statusCode).toBe(200);
    expect(updateOrgPlan).toHaveBeenCalledWith("org_123", "pro");
  });

  it("downgrades to free on past_due subscription.updated", async () => {
    const event = makeSubscriptionEvent("customer.subscription.updated", "past_due");
    mockConstructEvent.mockReturnValue(event);
    (getOrganizationByStripeCustomerId as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...MOCK_ORG,
      plan: "pro",
    });

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/billing/webhooks",
      headers: { ...WEBHOOK_HEADERS },
      body: JSON.stringify(event),
    });

    expect(res.statusCode).toBe(200);
    expect(updateOrgPlan).toHaveBeenCalledWith("org_123", "free");
  });

  it("downgrades to free on canceled subscription.updated", async () => {
    const event = makeSubscriptionEvent("customer.subscription.updated", "canceled");
    mockConstructEvent.mockReturnValue(event);
    (getOrganizationByStripeCustomerId as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...MOCK_ORG,
      plan: "pro",
    });

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/billing/webhooks",
      headers: { ...WEBHOOK_HEADERS },
      body: JSON.stringify(event),
    });

    expect(res.statusCode).toBe(200);
    expect(updateOrgPlan).toHaveBeenCalledWith("org_123", "free");
  });

  it("downgrades to free on unpaid subscription.updated", async () => {
    const event = makeSubscriptionEvent("customer.subscription.updated", "unpaid");
    mockConstructEvent.mockReturnValue(event);
    (getOrganizationByStripeCustomerId as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...MOCK_ORG,
      plan: "pro",
    });

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/billing/webhooks",
      headers: { ...WEBHOOK_HEADERS },
      body: JSON.stringify(event),
    });

    expect(res.statusCode).toBe(200);
    expect(updateOrgPlan).toHaveBeenCalledWith("org_123", "free");
  });
});

describe("POST /v1/billing/webhooks — subscription.deleted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env["STRIPE_SECRET_KEY"] = "sk_test_fake";
    process.env["STRIPE_WEBHOOK_SECRET"] = "whsec_test_fake";
  });

  afterEach(() => {
    restoreEnv();
  });

  it("downgrades to free on subscription.deleted", async () => {
    const event = makeSubscriptionEvent("customer.subscription.deleted", "canceled");
    mockConstructEvent.mockReturnValue(event);
    (getOrganizationByStripeCustomerId as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...MOCK_ORG,
      plan: "pro",
    });

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/billing/webhooks",
      headers: { ...WEBHOOK_HEADERS },
      body: JSON.stringify(event),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ received: true });
    expect(updateOrgPlan).toHaveBeenCalledWith("org_123", "free");
    expect(invalidateEntitlements).toHaveBeenCalledWith("org_123");
    expect(invalidateBillingStatusCache).toHaveBeenCalledWith("org_123");
  });
});

describe("POST /v1/billing/webhooks — invoice.payment_failed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env["STRIPE_SECRET_KEY"] = "sk_test_fake";
    process.env["STRIPE_WEBHOOK_SECRET"] = "whsec_test_fake";
  });

  afterEach(() => {
    restoreEnv();
  });

  it("logs warning but does not change plan on payment failure", async () => {
    const event = makeInvoiceEvent("cus_test123");
    mockConstructEvent.mockReturnValue(event);
    (getOrganizationByStripeCustomerId as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...MOCK_ORG,
      plan: "pro",
    });

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/billing/webhooks",
      headers: { ...WEBHOOK_HEADERS },
      body: JSON.stringify(event),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ received: true });
    // Payment failure handler only logs — no plan mutation
    expect(updateOrgPlan).not.toHaveBeenCalled();
    expect(getOrganizationByStripeCustomerId).toHaveBeenCalledWith("cus_test123");
  });

  it("handles payment failure when org is not found", async () => {
    const event = makeInvoiceEvent("cus_unknown");
    mockConstructEvent.mockReturnValue(event);
    (getOrganizationByStripeCustomerId as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/billing/webhooks",
      headers: { ...WEBHOOK_HEADERS },
      body: JSON.stringify(event),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ received: true });
  });
});

describe("POST /v1/billing/webhooks — unhandled event types", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env["STRIPE_SECRET_KEY"] = "sk_test_fake";
    process.env["STRIPE_WEBHOOK_SECRET"] = "whsec_test_fake";
  });

  afterEach(() => {
    restoreEnv();
  });

  it("returns 200 with received: true for unhandled event types", async () => {
    const event = makeUnhandledEvent();
    mockConstructEvent.mockReturnValue(event);

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/billing/webhooks",
      headers: { ...WEBHOOK_HEADERS },
      body: JSON.stringify(event),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ received: true });
    expect(updateOrgPlan).not.toHaveBeenCalled();
    expect(invalidateEntitlements).not.toHaveBeenCalled();
  });
});

describe("POST /v1/billing/webhooks — audit logging", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env["STRIPE_SECRET_KEY"] = "sk_test_fake";
    process.env["STRIPE_WEBHOOK_SECRET"] = "whsec_test_fake";
  });

  afterEach(() => {
    restoreEnv();
  });

  it("writes audit log when plan changes", async () => {
    const event = makeSubscriptionEvent("customer.subscription.created", "active");
    mockConstructEvent.mockReturnValue(event);
    (getOrganizationByStripeCustomerId as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...MOCK_ORG,
      plan: "free",
    });

    const app = buildApp();
    await app.inject({
      method: "POST",
      url: "/v1/billing/webhooks",
      headers: { ...WEBHOOK_HEADERS },
      body: JSON.stringify(event),
    });

    expect(writeAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: "org_123",
        action: "billing.plan_change",
        targetType: "organization",
        targetId: "org_123",
        metadata: expect.objectContaining({
          previousPlan: "free",
          newPlan: "pro",
          stripeEvent: "customer.subscription.created",
        }),
      }),
    );
  });

  it("does not write audit log when plan stays the same", async () => {
    const event = makeSubscriptionEvent("customer.subscription.deleted", "canceled");
    mockConstructEvent.mockReturnValue(event);
    // Org is already on free — deletion sets free again, so no change
    (getOrganizationByStripeCustomerId as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...MOCK_ORG,
      plan: "free",
    });

    const app = buildApp();
    await app.inject({
      method: "POST",
      url: "/v1/billing/webhooks",
      headers: { ...WEBHOOK_HEADERS },
      body: JSON.stringify(event),
    });

    expect(writeAuditLog).not.toHaveBeenCalled();
  });
});

describe("POST /v1/billing/webhooks — error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env["STRIPE_SECRET_KEY"] = "sk_test_fake";
    process.env["STRIPE_WEBHOOK_SECRET"] = "whsec_test_fake";
  });

  afterEach(() => {
    restoreEnv();
  });

  it("returns 500 when event processing throws", async () => {
    const event = makeSubscriptionEvent("customer.subscription.created", "active");
    mockConstructEvent.mockReturnValue(event);
    (getOrganizationByStripeCustomerId as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("DB connection lost"),
    );

    const app = buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/v1/billing/webhooks",
      headers: { ...WEBHOOK_HEADERS },
      body: JSON.stringify(event),
    });

    expect(res.statusCode).toBe(500);
    expect(res.json()).toMatchObject({ error: "Internal Server Error" });
  });
});
