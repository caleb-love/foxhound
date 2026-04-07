import type { FastifyInstance } from "fastify";
import Stripe from "stripe";
import { z } from "zod";
import {
  getOrganizationById,
  updateOrgStripeCustomerId,
  getUsageForPeriod,
} from "@foxhound/db";

function getStripe(): Stripe {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return new Stripe(key, { apiVersion: "2023-10-16" });
}

function currentPeriod(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

const CheckoutSchema = z.object({
  plan: z.enum(["pro_monthly", "pro_annual"]),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

export async function billingRoutes(fastify: FastifyInstance): Promise<void> {
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

      const priceId =
        plan === "pro_monthly"
          ? process.env["STRIPE_PRICE_ID_PRO_MONTHLY"]
          : process.env["STRIPE_PRICE_ID_PRO_ANNUAL"];

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
      const org = await getOrganizationById(request.orgId);
      if (!org) {
        return reply.code(404).send({ error: "Not Found", message: "Organization not found" });
      }

      const period = currentPeriod();
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

      return reply.code(200).send({
        plan: org.plan,
        period,
        spanCount: usage?.spanCount ?? 0,
        nextBillingDate,
      });
    },
  );
}
