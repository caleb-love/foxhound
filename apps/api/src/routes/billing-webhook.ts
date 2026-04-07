import type { FastifyInstance } from "fastify";
import Stripe from "stripe";
import { updateOrgPlan, getOrganizationByStripeCustomerId } from "@foxhound/db";
import { invalidateEntitlements } from "@foxhound/billing";
import { invalidateBillingStatusCache } from "./billing.js";

function getStripe(): Stripe {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
  return new Stripe(key, { apiVersion: "2023-10-16" });
}

function getWebhookSecret(): string {
  const secret = process.env["STRIPE_WEBHOOK_SECRET"];
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  return secret;
}

async function handleSubscriptionEvent(
  subscription: Stripe.Subscription,
  eventType: string,
): Promise<void> {
  const stripeCustomerId = subscription.customer as string;
  const org = await getOrganizationByStripeCustomerId(stripeCustomerId);
  if (!org) return;

  let plan: "free" | "pro" | "enterprise" = "free";

  if (
    eventType === "customer.subscription.created" ||
    eventType === "customer.subscription.updated"
  ) {
    if (subscription.status === "active" || subscription.status === "trialing") {
      // Default to pro for paid subscriptions; enterprise is set manually
      plan = org.plan === "enterprise" ? "enterprise" : "pro";
    } else if (
      subscription.status === "canceled" ||
      subscription.status === "unpaid" ||
      subscription.status === "past_due"
    ) {
      plan = "free";
    } else {
      return; // Ignore other statuses (e.g. "incomplete")
    }
  } else if (eventType === "customer.subscription.deleted") {
    plan = "free";
  } else {
    return;
  }

  await updateOrgPlan(org.id, plan);
  invalidateEntitlements(org.id);
  invalidateBillingStatusCache(org.id);
}

export function billingWebhookRoutes(fastify: FastifyInstance): void {
  // Override JSON parser in this scope to receive the raw Buffer needed for
  // Stripe signature verification. Fastify plugin encapsulation keeps this
  // isolated to webhook routes only.
  fastify.removeContentTypeParser("application/json");
  fastify.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (_req, body, done) => {
      done(null, body as Buffer);
    },
  );

  /**
   * POST /v1/billing/webhooks
   * Public endpoint — authenticated by Stripe-Signature header.
   * Handles subscription lifecycle and payment events.
   */
  fastify.post("/v1/billing/webhooks", async (request, reply) => {
    const sig = request.headers["stripe-signature"];
    if (!sig || typeof sig !== "string") {
      return reply.code(400).send({ error: "Bad Request", message: "Missing Stripe-Signature" });
    }

    let stripe: Stripe;
    let webhookSecret: string;
    try {
      stripe = getStripe();
      webhookSecret = getWebhookSecret();
    } catch (err) {
      fastify.log.error({ err }, "Stripe not configured");
      return reply
        .code(503)
        .send({ error: "Service Unavailable", message: "Billing not configured" });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(request.body as Buffer, sig, webhookSecret);
    } catch (err) {
      fastify.log.warn({ err }, "Webhook signature verification failed");
      return reply.code(400).send({ error: "Bad Request", message: "Invalid webhook signature" });
    }

    fastify.log.info({ eventType: event.type, eventId: event.id }, "Stripe webhook received");

    try {
      switch (event.type) {
        case "customer.subscription.created":
        case "customer.subscription.updated":
        case "customer.subscription.deleted": {
          const subscription = event.data.object;
          await handleSubscriptionEvent(subscription, event.type);
          break;
        }
        case "invoice.payment_failed": {
          const invoice = event.data.object;
          const stripeCustomerId = invoice.customer as string;
          const org = await getOrganizationByStripeCustomerId(stripeCustomerId);
          if (org) {
            fastify.log.warn(
              { orgId: org.id, invoiceId: invoice.id },
              "Payment failed for organization",
            );
          }
          break;
        }
        default:
          fastify.log.debug({ eventType: event.type }, "Unhandled Stripe event type");
      }
    } catch (err) {
      fastify.log.error({ err, eventId: event.id }, "Error processing webhook event");
      return reply.code(500).send({ error: "Internal Server Error" });
    }

    return reply.code(200).send({ received: true });
  });
}

/**
 * Report span usage to Stripe Metered Billing.
 * Call this at end of each billing period (e.g. via a cron job).
 * Overage: spans beyond 500K are billed at $0.10/1K.
 */
export async function reportUsageToStripe(
  stripeCustomerId: string,
  subscriptionItemId: string,
  quantity: number,
  timestamp: number,
): Promise<void> {
  const stripe = getStripe();
  await stripe.subscriptionItems.createUsageRecord(subscriptionItemId, {
    quantity,
    timestamp,
    action: "set",
  });
}
