"use client";

import { useState } from "react";

function isStripeUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === "checkout.stripe.com" || hostname === "billing.stripe.com";
  } catch {
    return false;
  }
}

interface TierFeature {
  label: string;
  free: string | boolean;
  pro: string | boolean;
  enterprise: string | boolean;
}

const FEATURES: TierFeature[] = [
  { label: "Spans / month",        free: "10K",       pro: "500K",      enterprise: "Unlimited" },
  { label: "Data retention",       free: "7 days",    pro: "90 days",   enterprise: "365 days" },
  { label: "Projects",             free: "1",         pro: "10",        enterprise: "Unlimited" },
  { label: "Seats",                free: "1",         pro: "5",         enterprise: "Unlimited" },
  { label: "Trace explorer",       free: true,        pro: true,        enterprise: true },
  { label: "Replay",               free: false,       pro: true,        enterprise: true },
  { label: "Run diff",             free: false,       pro: true,        enterprise: true },
  { label: "Audit log",            free: false,       pro: false,       enterprise: true },
  { label: "SSO / SAML",           free: false,       pro: false,       enterprise: true },
  { label: "SLA & dedicated CSM",  free: false,       pro: false,       enterprise: true },
];

const PRICES = {
  monthly: { pro: 49 },
  annual:  { pro: 39 },
};

function Check() {
  return (
    <span style={{ color: "var(--green)", fontWeight: 700, fontSize: 14 }}>✓</span>
  );
}

function Cross() {
  return (
    <span style={{ color: "var(--border)", fontWeight: 700, fontSize: 14 }}>—</span>
  );
}

function FeatureCell({ value }: { value: string | boolean }) {
  if (value === true) return <Check />;
  if (value === false) return <Cross />;
  return <span style={{ fontSize: 13, color: "var(--text)" }}>{value}</span>;
}

export default function PricingPage() {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [loadingCheckout, setLoadingCheckout] = useState(false);

  async function handleUpgrade() {
    setLoadingCheckout(true);
    try {
      const plan = billing === "annual" ? "pro_annual" : "pro_monthly";
      const origin = window.location.origin;
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          successUrl: `${origin}/settings/billing?checkout=success`,
          cancelUrl: `${origin}/pricing`,
        }),
      });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (!res.ok) throw new Error("Checkout failed");
      const { url } = (await res.json()) as { url: string };
      if (!isStripeUrl(url)) throw new Error("Invalid redirect URL");
      window.location.href = url;
    } catch {
      alert("Could not start checkout. Please try again.");
    } finally {
      setLoadingCheckout(false);
    }
  }

  const proPrice = PRICES[billing].pro;

  return (
    <div
      style={{
        padding: "48px 24px",
        maxWidth: 900,
        margin: "0 auto",
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 800,
            letterSpacing: "-0.5px",
            marginBottom: 12,
          }}
        >
          Simple, transparent pricing
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: 15, marginBottom: 28 }}>
          Compliance-grade observability for every team size.
        </p>

        {/* Annual / Monthly toggle */}
        <div
          style={{
            display: "inline-flex",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: 4,
            gap: 4,
          }}
        >
          {(["monthly", "annual"] as const).map((b) => (
            <button
              key={b}
              onClick={() => setBilling(b)}
              style={{
                padding: "6px 16px",
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
                background: billing === b ? "var(--accent)" : "transparent",
                color: billing === b ? "#fff" : "var(--text-muted)",
                transition: "background 0.15s",
                position: "relative",
              }}
            >
              {b === "monthly" ? "Monthly" : "Annual"}
              {b === "annual" && (
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: 10,
                    fontWeight: 700,
                    background: "var(--green)",
                    color: "#0c0c10",
                    borderRadius: 4,
                    padding: "1px 5px",
                    letterSpacing: "0.3px",
                  }}
                >
                  −20%
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tier cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 16,
          marginBottom: 48,
        }}
      >
        {/* Free */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "28px 24px",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.8px",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            Free
          </div>
          <div
            style={{
              fontSize: 36,
              fontWeight: 800,
              letterSpacing: "-1px",
              marginBottom: 4,
            }}
          >
            $0
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>
            Forever free
          </div>
          <a
            href="/signup"
            style={{
              display: "block",
              textAlign: "center",
              padding: "10px 0",
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text)",
              textDecoration: "none",
            }}
          >
            Get started free
          </a>
        </div>

        {/* Pro */}
        <div
          style={{
            background: "var(--surface)",
            border: "2px solid var(--accent)",
            borderRadius: 12,
            padding: "28px 24px",
            position: "relative",
          }}
        >
          <span
            style={{
              position: "absolute",
              top: -11,
              left: "50%",
              transform: "translateX(-50%)",
              background: "var(--accent)",
              color: "#fff",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.6px",
              textTransform: "uppercase",
              borderRadius: 4,
              padding: "2px 10px",
              whiteSpace: "nowrap",
            }}
          >
            Most popular
          </span>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.8px",
              color: "var(--accent)",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            Pro
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
            <span
              style={{
                fontSize: 36,
                fontWeight: 800,
                letterSpacing: "-1px",
              }}
            >
              ${proPrice}
            </span>
            <span style={{ color: "var(--text-muted)", fontSize: 13 }}>/mo</span>
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>
            {billing === "annual" ? "Billed annually" : "Billed monthly"}
          </div>
          <button
            onClick={() => { void handleUpgrade(); }}
            disabled={loadingCheckout}
            style={{
              display: "block",
              width: "100%",
              textAlign: "center",
              padding: "10px 0",
              background: loadingCheckout ? "rgba(107,122,255,0.5)" : "var(--accent)",
              border: "none",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              color: "#fff",
              cursor: loadingCheckout ? "not-allowed" : "pointer",
            }}
          >
            {loadingCheckout ? "Redirecting…" : "Upgrade to Pro"}
          </button>
        </div>

        {/* Enterprise */}
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: "28px 24px",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.8px",
              color: "var(--text-muted)",
              textTransform: "uppercase",
              marginBottom: 8,
            }}
          >
            Enterprise
          </div>
          <div
            style={{
              fontSize: 36,
              fontWeight: 800,
              letterSpacing: "-1px",
              marginBottom: 4,
            }}
          >
            Custom
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 24 }}>
            Volume pricing
          </div>
          <a
            href="mailto:sales@foxhound.ai"
            style={{
              display: "block",
              textAlign: "center",
              padding: "10px 0",
              background: "var(--surface-2)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text)",
              textDecoration: "none",
            }}
          >
            Contact sales
          </a>
        </div>
      </div>

      {/* Feature comparison table */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        {/* Table header */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr repeat(3, 120px)",
            padding: "12px 24px",
            background: "var(--surface-2)",
            borderBottom: "1px solid var(--border)",
            fontSize: 11,
            fontWeight: 700,
            color: "var(--text-muted)",
            letterSpacing: "0.6px",
            textTransform: "uppercase",
          }}
        >
          <span>Feature</span>
          <span style={{ textAlign: "center" }}>Free</span>
          <span style={{ textAlign: "center", color: "var(--accent)" }}>Pro</span>
          <span style={{ textAlign: "center" }}>Enterprise</span>
        </div>

        {FEATURES.map((f, i) => (
          <div
            key={f.label}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr repeat(3, 120px)",
              padding: "12px 24px",
              borderBottom: i < FEATURES.length - 1 ? "1px solid var(--border)" : "none",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{f.label}</span>
            <span style={{ textAlign: "center" }}>
              <FeatureCell value={f.free} />
            </span>
            <span style={{ textAlign: "center" }}>
              <FeatureCell value={f.pro} />
            </span>
            <span style={{ textAlign: "center" }}>
              <FeatureCell value={f.enterprise} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
