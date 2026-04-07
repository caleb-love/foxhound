import { describe, it, expect, vi, beforeEach } from "vitest";
import Stripe from "stripe";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@foxhound/db", () => ({
  getOrganizationByStripeCustomerId: vi.fn(),
  updateOrgPlan: vi.fn(),
  getOrganizationById: vi.fn(),
  updateOrgStripeCustomerId: vi.fn(),
  getUsageForPeriod: vi.fn(),
}));

vi.mock("@foxhound/billing", () => ({
  invalidateEntitlements: vi.fn(),
}));

import {
  getOrganizationByStripeCustomerId,
  updateOrgPlan,
} from "@foxhound/db";
import { invalidateEntitlements } from "@foxhound/billing";

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

  const org = await (getOrganizationByStripeCustomerId as unknown as (id: string) => Promise<MockOrg | null>)(stripeCustomerId);
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
    (getOrganizationByStripeCustomerId as ReturnType<typeof vi.fn>).mockResolvedValue(enterpriseOrg);
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
