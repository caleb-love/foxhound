"use client";

import { useState } from "react";

// ─── Hero Trace Tree ─────────────────────────────────────────────────────────

function StatusDot({ color }: { color: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: color,
        flexShrink: 0,
      }}
    />
  );
}

interface TraceSpan {
  name: string;
  kind: string;
  duration: string;
  status: "ok" | "error" | "running";
  depth: number;
  bar: number; // width % of timing bar
  barOffset: number; // left % offset
}

const TRACE_SPANS: TraceSpan[] = [
  {
    name: "support-agent",
    kind: "agent",
    duration: "1.24s",
    status: "ok",
    depth: 0,
    bar: 100,
    barOffset: 0,
  },
  {
    name: "tool:retrieve_docs",
    kind: "tool_call",
    duration: "320ms",
    status: "ok",
    depth: 1,
    bar: 25,
    barOffset: 0,
  },
  {
    name: "llm:gpt-4o",
    kind: "llm_call",
    duration: "680ms",
    status: "ok",
    depth: 1,
    bar: 55,
    barOffset: 27,
  },
  {
    name: "tool:send_reply",
    kind: "tool_call",
    duration: "240ms",
    status: "ok",
    depth: 1,
    bar: 19,
    barOffset: 83,
  },
];

const STATUS_COLORS = { ok: "#3dd68c", error: "#f25f5c", running: "#6b7aff" };
const KIND_COLORS: Record<string, string> = {
  agent: "#6b7aff",
  tool_call: "#f59e0b",
  llm_call: "#c084fc",
};

function HeroTraceTree() {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        overflow: "hidden",
        fontFamily: "var(--font-mono)",
        fontSize: 12,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "10px 16px",
          background: "var(--surface-2)",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", gap: 6 }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#f25f5c",
              display: "inline-block",
            }}
          />
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#f59e0b",
              display: "inline-block",
            }}
          />
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#3dd68c",
              display: "inline-block",
            }}
          />
        </div>
        <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
          Trace Explorer — run_7f3a2c1b
        </span>
      </div>
      {/* Column headers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "240px 1fr",
          padding: "6px 16px",
          background: "var(--surface-2)",
          borderBottom: "1px solid var(--border)",
          fontSize: 10,
          fontWeight: 700,
          color: "var(--text-muted)",
          letterSpacing: "0.5px",
          textTransform: "uppercase",
        }}
      >
        <span>Span</span>
        <span>Timeline</span>
      </div>
      {/* Spans */}
      {TRACE_SPANS.map((span, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: "240px 1fr",
            padding: "7px 16px",
            borderBottom: i < TRACE_SPANS.length - 1 ? "1px solid rgba(42,42,58,0.6)" : "none",
            alignItems: "center",
          }}
        >
          {/* Span label */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              paddingLeft: span.depth * 20,
            }}
          >
            {span.depth > 0 && (
              <span style={{ color: "var(--border)", fontSize: 10, marginLeft: -4 }}>└</span>
            )}
            <StatusDot color={STATUS_COLORS[span.status]} />
            <span
              style={{
                color: "var(--text)",
                fontSize: 12,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {span.name}
            </span>
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.4px",
                color: KIND_COLORS[span.kind] ?? "var(--text-muted)",
                background: `${KIND_COLORS[span.kind] ?? "var(--border)"}22`,
                padding: "1px 5px",
                borderRadius: 3,
                whiteSpace: "nowrap",
              }}
            >
              {span.kind}
            </span>
          </div>
          {/* Timeline bar */}
          <div style={{ position: "relative", height: 18 }}>
            <div
              style={{
                position: "absolute",
                left: `${span.barOffset}%`,
                width: `${span.bar}%`,
                height: "100%",
                background: `${KIND_COLORS[span.kind] ?? "var(--accent)"}33`,
                borderRadius: 3,
                border: `1px solid ${KIND_COLORS[span.kind] ?? "var(--accent)"}66`,
              }}
            />
            <span
              style={{
                position: "absolute",
                right: 0,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-muted)",
                fontSize: 10,
              }}
            >
              {span.duration}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Features Grid ────────────────────────────────────────────────────────────

interface Feature {
  icon: string;
  title: string;
  description: string;
  color: string;
}

const FEATURES: Feature[] = [
  {
    icon: "⬡",
    title: "Trace Explorer",
    description:
      "Browse, search, and filter traces with full span trees — timestamps, attributes, and events in one view.",
    color: "#6b7aff",
  },
  {
    icon: "◎",
    title: "Span Replay",
    description:
      "Reconstruct agent state at any point in time. See exactly what data was available when a decision was made.",
    color: "#c084fc",
  },
  {
    icon: "⟺",
    title: "Run Diff",
    description: "Compare two runs side-by-side. Pinpoint where agent behavior diverged and why.",
    color: "#60a5fa",
  },
  {
    icon: "◈",
    title: "Audit Log",
    description:
      "Enterprise-grade audit trail. Every action produces a structured, queryable event for compliance.",
    color: "#3dd68c",
  },
];

function FeatureCard({ feature }: { feature: Feature }) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "28px 24px",
        transition: "border-color 0.15s",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: `${feature.color}18`,
          border: `1px solid ${feature.color}44`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 18,
          color: feature.color,
          marginBottom: 16,
          fontFamily: "var(--font-mono)",
        }}
      >
        {feature.icon}
      </div>
      <h3
        style={{
          fontSize: 15,
          fontWeight: 700,
          marginBottom: 8,
          color: "var(--text)",
        }}
      >
        {feature.title}
      </h3>
      <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
        {feature.description}
      </p>
    </div>
  );
}

// ─── Code Snippets ────────────────────────────────────────────────────────────

const TS_CODE = `import { FoxhoundClient } from "@foxhound/sdk";

const fox = new FoxhoundClient({
  apiKey: process.env.FOXHOUND_API_KEY!,
  endpoint: "https://your-instance.foxhound.ai",
});

const tracer = fox.startTrace({ agentId: "support-agent" });
const span = tracer.startSpan({
  name: "tool:search",
  kind: "tool_call",
});
span.setAttribute("query", "refund policy");
span.end();
await tracer.flush();`;

const PY_CODE = `from fox_sdk import FoxClient

fox = FoxClient(
    api_key="sk-...",
    endpoint="https://your-instance.foxhound.ai",
)

async with fox.trace(agent_id="support-agent") as tracer:
    span = tracer.start_span(
        name="tool:search",
        kind="tool_call",
    )
    span.set_attribute("query", "refund policy")
    span.end()`;

function highlight(code: string, lang: "ts" | "py"): React.ReactNode[] {
  const lines = code.split("\n");
  const keywords =
    lang === "ts"
      ? ["import", "from", "const", "new", "await", "async"]
      : ["from", "import", "async", "with", "as"];

  return lines.map((line, i) => {
    // Simple token colorization: keywords, strings, comments
    const parts: React.ReactNode[] = [];
    const rest = line;
    let key = 0;

    // Check for comments
    const commentIdx = lang === "ts" ? rest.indexOf("//") : rest.indexOf("#");
    if (commentIdx !== -1) {
      const before = rest.slice(0, commentIdx);
      const comment = rest.slice(commentIdx);
      if (before) parts.push(<span key={key++}>{before}</span>);
      parts.push(
        <span key={key++} style={{ color: "#64748b" }}>
          {comment}
        </span>,
      );
      return <div key={i}>{parts}</div>;
    }

    // Tokenize roughly
    const tokenRe =
      /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|[A-Za-z_$][A-Za-z0-9_$]*|[^A-Za-z_$"']+)/g;
    let match: RegExpExecArray | null;
    while ((match = tokenRe.exec(rest)) !== null) {
      const tok = match[0];
      if ((tok.startsWith('"') || tok.startsWith("'")) && !tok.startsWith("//")) {
        parts.push(
          <span key={key++} style={{ color: "#3dd68c" }}>
            {tok}
          </span>,
        );
      } else if (keywords.includes(tok)) {
        parts.push(
          <span key={key++} style={{ color: "#c084fc" }}>
            {tok}
          </span>,
        );
      } else if (/^\d/.test(tok)) {
        parts.push(
          <span key={key++} style={{ color: "#f59e0b" }}>
            {tok}
          </span>,
        );
      } else if (/^[A-Z]/.test(tok)) {
        parts.push(
          <span key={key++} style={{ color: "#60a5fa" }}>
            {tok}
          </span>,
        );
      } else {
        parts.push(<span key={key++}>{tok}</span>);
      }
    }

    return (
      <div key={i} style={{ minHeight: "1.5em" }}>
        {parts.length ? parts : "\u00a0"}
      </div>
    );
  });
}

function CodeSnippets() {
  const [tab, setTab] = useState<"ts" | "py">("ts");

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          borderBottom: "1px solid var(--border)",
          padding: "0 4px",
          background: "var(--surface-2)",
        }}
      >
        {(["ts", "py"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "10px 16px",
              background: "none",
              border: "none",
              borderBottom: tab === t ? "2px solid var(--accent)" : "2px solid transparent",
              color: tab === t ? "var(--text)" : "var(--text-muted)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "var(--font-mono)",
              transition: "color 0.15s",
            }}
          >
            {t === "ts" ? "TypeScript" : "Python"}
          </button>
        ))}
      </div>
      {/* Code */}
      <pre
        style={{
          padding: "20px 24px",
          margin: 0,
          fontSize: 12,
          lineHeight: 1.7,
          color: "var(--text)",
          overflowX: "auto",
        }}
        aria-label={`${tab === "ts" ? "TypeScript" : "Python"} SDK example`}
      >
        <code>{highlight(tab === "ts" ? TS_CODE : PY_CODE, tab)}</code>
      </pre>
    </div>
  );
}

// ─── Architecture Flow ─────────────────────────────────────────────────────────

const ARCH_NODES = [
  { label: "Your Agents", sub: "TS / Python" },
  { label: "Foxhound SDK", sub: "OpenTelemetry" },
  { label: "Foxhound API", sub: "Fastify" },
  { label: "PostgreSQL", sub: "Drizzle ORM" },
  { label: "Dashboard", sub: "Next.js" },
];

function ArchFlow() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 0,
        flexWrap: "wrap",
        rowGap: 16,
      }}
    >
      {ARCH_NODES.map((node, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: "12px 20px",
              textAlign: "center",
              minWidth: 100,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>
              {node.label}
            </div>
            <div
              style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
            >
              {node.sub}
            </div>
          </div>
          {i < ARCH_NODES.length - 1 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "0 8px",
                color: "var(--accent)",
                fontSize: 16,
              }}
            >
              →
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Pricing Summary ──────────────────────────────────────────────────────────

function PricingSummary() {
  const tiers = [
    {
      name: "Free",
      price: "$0",
      billing: "Forever free",
      spans: "10K spans/mo",
      retention: "7-day retention",
      cta: "Get started free",
      href: "/signup",
      accent: false,
    },
    {
      name: "Pro",
      price: "$49",
      billing: "per month",
      spans: "500K spans/mo",
      retention: "90-day retention",
      cta: "Upgrade to Pro",
      href: "/pricing",
      accent: true,
    },
    {
      name: "Enterprise",
      price: "Custom",
      billing: "Volume pricing",
      spans: "Unlimited spans",
      retention: "365-day retention",
      cta: "Contact sales",
      href: "mailto:sales@foxhound.ai",
      accent: false,
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: 16,
      }}
      className="pricing-grid"
    >
      {tiers.map((tier) => (
        <div
          key={tier.name}
          style={{
            background: "var(--surface)",
            border: tier.accent ? "2px solid var(--accent)" : "1px solid var(--border)",
            borderRadius: 12,
            padding: "24px 20px",
            position: "relative",
          }}
        >
          {tier.accent && (
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
          )}
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.8px",
              color: tier.accent ? "var(--accent)" : "var(--text-muted)",
              textTransform: "uppercase",
              marginBottom: 6,
            }}
          >
            {tier.name}
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.8px", marginBottom: 2 }}>
            {tier.price}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
            {tier.billing}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>
            {tier.spans}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 20 }}>
            {tier.retention}
          </div>
          <a
            href={tier.href}
            style={{
              display: "block",
              textAlign: "center",
              padding: "9px 0",
              background: tier.accent ? "var(--accent)" : "var(--surface-2)",
              border: tier.accent ? "none" : "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              color: tier.accent ? "#fff" : "var(--text)",
              textDecoration: "none",
            }}
          >
            {tier.cta}
          </a>
        </div>
      ))}
    </div>
  );
}

// ─── Main Landing Component ───────────────────────────────────────────────────

export function Landing() {
  return (
    <>
      <style>{`
        @media (max-width: 899px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .features-grid { grid-template-columns: 1fr !important; }
          .pricing-grid { grid-template-columns: 1fr !important; }
          .hero-headline { font-size: 32px !important; }
          .arch-flow { flex-direction: column !important; }
        }
        @media (max-width: 599px) {
          .hero-headline { font-size: 26px !important; }
          .section-title { font-size: 22px !important; }
          .landing-section { padding: 48px 20px !important; }
        }
      `}</style>

      {/* Hero */}
      <section
        className="landing-section"
        style={{ padding: "80px 24px 64px", maxWidth: 1100, margin: "0 auto" }}
      >
        <div
          className="hero-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 64,
            alignItems: "center",
          }}
        >
          {/* Left: copy */}
          <div>
            {/* Badge */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: "rgba(107,122,255,0.1)",
                border: "1px solid rgba(107,122,255,0.3)",
                borderRadius: 20,
                padding: "4px 14px",
                marginBottom: 24,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "var(--accent)",
                  display: "inline-block",
                }}
              />
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--accent)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                MIT License · Open Source
              </span>
            </div>

            <h1
              className="hero-headline"
              style={{
                fontSize: 42,
                fontWeight: 800,
                letterSpacing: "-1.5px",
                lineHeight: 1.15,
                marginBottom: 20,
                color: "var(--text)",
              }}
            >
              Compliance-grade observability for AI agent fleets
            </h1>

            <p
              style={{
                fontSize: 16,
                color: "var(--text-muted)",
                lineHeight: 1.7,
                marginBottom: 32,
                maxWidth: 480,
              }}
            >
              Trace, replay, and audit every agent decision — from tool call to business outcome.
            </p>

            {/* CTAs */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <a
                href="/signup"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "12px 24px",
                  background: "var(--accent)",
                  color: "#fff",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: "none",
                  letterSpacing: "-0.2px",
                }}
              >
                Get started free
              </a>
              <a
                href="https://github.com/foxhound-sh/foxhound"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "12px 24px",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--text)",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>★</span>
                Star on GitHub
              </a>
            </div>

            {/* Badges */}
            <div
              style={{
                display: "flex",
                gap: 16,
                marginTop: 28,
                flexWrap: "wrap",
              }}
            >
              {[
                { label: "MIT", desc: "License" },
                { label: "TypeScript", desc: "SDK" },
                { label: "Python", desc: "SDK" },
                { label: "Self-host", desc: "Ready" },
              ].map((b) => (
                <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      fontFamily: "var(--font-mono)",
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      borderRadius: 4,
                      padding: "2px 8px",
                      color: "var(--text)",
                    }}
                  >
                    {b.label}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{b.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: trace tree visual */}
          <div>
            <HeroTraceTree />
          </div>
        </div>
      </section>

      {/* Social proof strip */}
      <section
        style={{
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
          padding: "20px 24px",
          background: "var(--surface)",
        }}
      >
        <div
          style={{
            maxWidth: 900,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Built for teams shipping autonomous agents
          </span>
          <span style={{ color: "var(--border)" }}>·</span>
          <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--accent)" }}>
            OpenTelemetry compatible
          </span>
          <span style={{ color: "var(--border)" }}>·</span>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Self-host in minutes</span>
        </div>
      </section>

      {/* Features */}
      <section
        className="landing-section"
        id="features"
        style={{ padding: "80px 24px", maxWidth: 1100, margin: "0 auto" }}
      >
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2
            className="section-title"
            style={{
              fontSize: 30,
              fontWeight: 800,
              letterSpacing: "-0.8px",
              marginBottom: 12,
            }}
          >
            Everything you need to understand your agents
          </h2>
          <p style={{ fontSize: 15, color: "var(--text-muted)", maxWidth: 520, margin: "0 auto" }}>
            From first-request tracing to enterprise audit logs — Foxhound covers the full
            observability lifecycle.
          </p>
        </div>

        <div
          className="features-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 16,
          }}
        >
          {FEATURES.map((f) => (
            <FeatureCard key={f.title} feature={f} />
          ))}
        </div>
      </section>

      {/* Code snippets */}
      <section
        className="landing-section"
        style={{
          padding: "80px 24px",
          background: "var(--surface)",
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <h2
              className="section-title"
              style={{
                fontSize: 30,
                fontWeight: 800,
                letterSpacing: "-0.8px",
                marginBottom: 12,
              }}
            >
              Instrument in minutes
            </h2>
            <p style={{ fontSize: 15, color: "var(--text-muted)" }}>
              Drop the SDK into any agent runtime. One API, full observability.
            </p>
          </div>
          <CodeSnippets />
        </div>
      </section>

      {/* Architecture */}
      <section
        className="landing-section"
        style={{ padding: "80px 24px", maxWidth: 1100, margin: "0 auto" }}
      >
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2
            className="section-title"
            style={{
              fontSize: 30,
              fontWeight: 800,
              letterSpacing: "-0.8px",
              marginBottom: 12,
            }}
          >
            Simple architecture, serious scale
          </h2>
          <p style={{ fontSize: 15, color: "var(--text-muted)", maxWidth: 480, margin: "0 auto" }}>
            Data flows from your agents through our SDK into the Foxhound API, stored in PostgreSQL,
            and surfaced in the dashboard.
          </p>
        </div>
        <ArchFlow />
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 24,
            marginTop: 32,
            flexWrap: "wrap",
          }}
        >
          {["TypeScript", "Fastify", "Next.js", "PostgreSQL", "Drizzle ORM"].map((tech) => (
            <span
              key={tech}
              style={{
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "var(--font-mono)",
                color: "var(--text-muted)",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: "4px 12px",
              }}
            >
              {tech}
            </span>
          ))}
        </div>
      </section>

      {/* Pricing summary */}
      <section
        className="landing-section"
        style={{
          padding: "80px 24px",
          background: "var(--surface)",
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <h2
              className="section-title"
              style={{
                fontSize: 30,
                fontWeight: 800,
                letterSpacing: "-0.8px",
                marginBottom: 12,
              }}
            >
              Start free, scale when ready
            </h2>
            <p style={{ fontSize: 15, color: "var(--text-muted)" }}>
              No credit card required for the free tier.{" "}
              <a href="/pricing" style={{ color: "var(--accent)" }}>
                See full feature comparison →
              </a>
            </p>
          </div>
          <PricingSummary />
        </div>
      </section>

      {/* Open source CTA */}
      <section
        className="landing-section"
        style={{ padding: "80px 24px", maxWidth: 900, margin: "0 auto", textAlign: "center" }}
      >
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            padding: "56px 40px",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "rgba(107,122,255,0.12)",
              border: "1px solid rgba(107,122,255,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
              fontSize: 24,
            }}
          >
            ⬡
          </div>
          <h2
            className="section-title"
            style={{
              fontSize: 28,
              fontWeight: 800,
              letterSpacing: "-0.6px",
              marginBottom: 12,
            }}
          >
            Open source. Self-host anywhere.
          </h2>
          <p
            style={{
              fontSize: 15,
              color: "var(--text-muted)",
              maxWidth: 480,
              margin: "0 auto 32px",
              lineHeight: 1.7,
            }}
          >
            Foxhound is MIT-licensed and ships as a single Docker Compose stack. Your data never
            leaves your infrastructure. Audit the code. Fork it. Contribute.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a
              href="https://github.com/foxhound-sh/foxhound"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 24px",
                background: "var(--accent)",
                color: "#fff",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              <span style={{ fontFamily: "var(--font-mono)" }}>★</span>
              Star on GitHub
            </a>
            <a
              href="/signup"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "12px 24px",
                background: "var(--surface-2)",
                border: "1px solid var(--border)",
                color: "var(--text)",
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Get started free
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer
        style={{
          borderTop: "1px solid var(--border)",
          padding: "24px",
          background: "var(--surface)",
        }}
      >
        <div
          style={{
            maxWidth: 1100,
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>Foxhound</span>
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              © {new Date().getFullYear()} · MIT License
            </span>
          </div>
          <div style={{ display: "flex", gap: 24 }}>
            {[
              { label: "GitHub", href: "https://github.com/foxhound-sh/foxhound" },
              { label: "Pricing", href: "/pricing" },
              { label: "Login", href: "/login" },
              { label: "Sign up", href: "/signup" },
            ].map((link) => (
              <a key={link.label} href={link.href} className="nav-link" style={{ fontSize: 13 }}>
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </>
  );
}
