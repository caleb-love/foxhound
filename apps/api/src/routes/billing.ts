import type { FastifyInstance } from "fastify";
import Stripe from "stripe";
import { z } from "zod";
import { getOrganizationById, updateOrgStripeCustomerId, getUsageForPeriod } from "@foxhound/db";
import { getEntitlements, currentBillingPeriod, periodBounds } from "@foxhound/billing";

// ── Billing status cache ──────────────────────────────────────────────────────
// Simple in-memory TTL cache for GET /v1/billing/status responses.
// Keyed by orgId; invalidated on Stripe subscription webhook events.

const BILLING_STATUS_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface BillingStatusEntry {
  data: BillingStatusPayload;
  expiresAt: number;
}

interface BillingStatusPayload {
  plan: string;
  period: string;
  spanCount: number;
  nextBillingDate: string | null;
}

const billingStatusCache = new Map<string, BillingStatusEntry>();

export function invalidateBillingStatusCache(orgId: string): void {
  billingStatusCache.delete(orgId);
}

function getStripe(): Stripe {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return new Stripe(key, { apiVersion: "2023-10-16" });
}

const CheckoutSchema = z.object({
  plan: z.enum(["pro_monthly", "pro_annual", "team_monthly", "team_annual"]),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

export function billingRoutes(fastify: FastifyInstance): void {
  /**
   * POST /v1/billing/checkout
   * Create a Stripe Checkout session. Requires JWT.
   * Returns { url } — the hosted Stripe checkout page.
   */
  fastify.post(
    "/v1/billing/checkout",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const result = CheckoutSchema.safeParse(request.body);
      if (!result.success) {
        return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
      }

      const { plan, successUrl, cancelUrl } = result.data;

      const priceMap: Record<string, string | undefined> = {
        pro_monthly: process.env["STRIPE_PRICE_ID_PRO_MONTHLY"],
        pro_annual: process.env["STRIPE_PRICE_ID_PRO_ANNUAL"],
        team_monthly: process.env["STRIPE_PRICE_ID_TEAM_MONTHLY"],
        team_annual: process.env["STRIPE_PRICE_ID_TEAM_ANNUAL"],
      };
      const priceId = priceMap[plan];

      if (!priceId) {
        return reply
          .code(503)
          .send({ error: "Service Unavailable", message: "Billing not fully configured" });
      }

      let stripe: Stripe;
      try {
        stripe = getStripe();
      } catch {
        return reply
          .code(503)
          .send({ error: "Service Unavailable", message: "Billing not configured" });
      }

      const org = await getOrganizationById(request.orgId);
      if (!org) {
        return reply.code(404).send({ error: "Not Found", message: "Organization not found" });
      }

      // Ensure a Stripe customer exists for the org
      let customerId = org.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          metadata: { orgId: org.id, orgSlug: org.slug },
        });
        customerId = customer.id;
        await updateOrgStripeCustomerId(org.id, customerId);
      }

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { orgId: org.id },
      });

      return reply.code(200).send({ url: session.url });
    },
  );

  /**
   * POST /v1/billing/portal
   * Create a Stripe Customer Portal session. Requires JWT.
   * Returns { url } — the hosted portal page for plan management.
   */
  fastify.post(
    "/v1/billing/portal",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const BodySchema = z.object({ returnUrl: z.string().url() });
      const result = BodySchema.safeParse(request.body);
      if (!result.success) {
        return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
      }

      const { returnUrl } = result.data;

      let stripe: Stripe;
      try {
        stripe = getStripe();
      } catch {
        return reply
          .code(503)
          .send({ error: "Service Unavailable", message: "Billing not configured" });
      }

      const org = await getOrganizationById(request.orgId);
      if (!org) {
        return reply.code(404).send({ error: "Not Found", message: "Organization not found" });
      }

      if (!org.stripeCustomerId) {
        return reply
          .code(400)
          .send({ error: "Bad Request", message: "No active subscription found" });
      }

      const session = await stripe.billingPortal.sessions.create({
        customer: org.stripeCustomerId,
        return_url: returnUrl,
      });

      return reply.code(200).send({ url: session.url });
    },
  );

  /**
   * GET /v1/billing/status
   * Return current plan, usage counts, and next billing date. Requires JWT.
   */
  fastify.get(
    "/v1/billing/status",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const cached = billingStatusCache.get(request.orgId);
      if (cached && cached.expiresAt > Date.now()) {
        return reply.code(200).send(cached.data);
      }

      const org = await getOrganizationById(request.orgId);
      if (!org) {
        return reply.code(404).send({ error: "Not Found", message: "Organization not found" });
      }

      const period = currentBillingPeriod();
      const usage = await getUsageForPeriod(request.orgId, period);

      let nextBillingDate: string | null = null;
      if (org.stripeCustomerId) {
        try {
          const stripe = getStripe();
          const subscriptions = await stripe.subscriptions.list({
            customer: org.stripeCustomerId,
            status: "active",
            limit: 1,
          });
          const sub = subscriptions.data[0];
          if (sub) {
            nextBillingDate = new Date(sub.current_period_end * 1000).toISOString();
          }
        } catch {
          // Stripe not configured or request failed — omit billing date
        }
      }

      const data: BillingStatusPayload = {
        plan: org.plan,
        period,
        spanCount: usage?.spanCount ?? 0,
        nextBillingDate,
      };
      billingStatusCache.set(request.orgId, {
        data,
        expiresAt: Date.now() + BILLING_STATUS_TTL_MS,
      });

      return reply.code(200).send(data);
    },
  );

  /**
   * GET /v1/billing/usage
   * Return current period span usage and limits for the dashboard widget. Requires JWT.
   * Returns { spansUsed, spansLimit, periodStart, periodEnd }.
   */
  fastify.get(
    "/v1/billing/usage",
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const period = currentBillingPeriod();
      const [entitlements, usage] = await Promise.all([
        getEntitlements(request.orgId),
        getUsageForPeriod(request.orgId, period),
      ]);

      const { periodStart, periodEnd } = periodBounds(period);

      return reply.code(200).send({
        spansUsed: usage?.spanCount ?? 0,
        spansLimit: entitlements.maxSpans,
        periodStart,
        periodEnd,
      });
    },
  );

  /**
   * POST /v1/billing/report-usage
   * Report pro-tier span overage to Stripe as a metered usage record.
   * Designed to be called by a nightly cron job (secured by internal secret header).
   * Only reports spans beyond the 500K included pro allocation.
   */
  fastify.post("/v1/billing/report-usage", async (request, reply) => {
    const internalSecret = process.env["INTERNAL_CRON_SECRET"];
    if (!internalSecret) {
      return reply
        .code(503)
        .send({ error: "Service Unavailable", message: "Internal cron secret not configured" });
    }
    const provided = (request.headers["x-internal-secret"] as string | undefined) ?? "";
    if (provided !== internalSecret) {
      return reply.code(401).send({ error: "Unauthorized" });
    }

    const BodySchema = z.object({ orgId: z.string().min(1) });
    const result = BodySchema.safeParse(request.body);
    if (!result.success) {
      return reply.code(400).send({ error: "Bad Request", issues: result.error.issues });
    }

    const { orgId } = result.data;
    const period = currentBillingPeriod();

    const [org, entitlements, usage] = await Promise.all([
      getOrganizationById(orgId),
      getEntitlements(orgId),
      getUsageForPeriod(orgId, period),
    ]);

    if (!org) {
      return reply.code(404).send({ error: "Not Found", message: "Organization not found" });
    }

    const spansUsed = usage?.spanCount ?? 0;
    const includedLimit = entitlements.maxSpans;

    // Only paid orgs (pro/team) with a Stripe subscription get metered overage billing
    if (!["pro", "team"].includes(org.plan) || !org.stripeCustomerId || includedLimit <= 0) {
      return reply.code(200).send({ reported: false, reason: "not_applicable" });
    }

    const overage = Math.max(0, spansUsed - includedLimit);
    if (overage === 0) {
      return reply
        .code(200)
        .send({ reported: false, reason: "no_overage", spansUsed, includedLimit });
    }

    let stripe: Stripe;
    try {
      stripe = getStripe();
    } catch {
      return reply
        .code(503)
        .send({ error: "Service Unavailable", message: "Billing not configured" });
    }

    // Find the active subscription and its first metered item
    const subscriptions = await stripe.subscriptions.list({
      customer: org.stripeCustomerId,
      status: "active",
      limit: 1,
    });
    const sub = subscriptions.data[0];
    if (!sub) {
      return reply.code(200).send({ reported: false, reason: "no_active_subscription" });
    }

    const subItem = sub.items.data[0];
    if (!subItem) {
      return reply.code(200).send({ reported: false, reason: "no_subscription_item" });
    }

    await stripe.subscriptionItems.createUsageRecord(subItem.id, {
      quantity: overage,
      timestamp: Math.floor(Date.now() / 1000),
      action: "set",
    });

    fastify.log.info(
      { orgId, period, overage, subItemId: subItem.id },
      "Reported span overage to Stripe",
    );

    return reply.code(200).send({ reported: true, overage, period });
  });
}
