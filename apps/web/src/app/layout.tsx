import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fox — AI Agent Observability",
  description: "Compliance-grade observability for AI agent fleets",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <nav
          style={{
            background: "var(--surface)",
            borderBottom: "1px solid var(--border)",
            padding: "0 24px",
            height: 48,
            display: "flex",
            alignItems: "center",
            gap: 24,
            position: "sticky",
            top: 0,
            zIndex: 100,
          }}
        >
          <a
            href="/"
            style={{
              color: "var(--text)",
              fontWeight: 700,
              fontSize: 15,
              letterSpacing: "-0.3px",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span
              style={{
                background: "var(--accent)",
                color: "#fff",
                borderRadius: 4,
                padding: "1px 6px",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.5px",
              }}
            >
              FOX
            </span>
            Observability
          </a>
          <a href="/traces" style={{ color: "var(--text-muted)", fontSize: 13 }}>
            Traces
          </a>
        </nav>
        <main style={{ minHeight: "calc(100vh - 48px)" }}>{children}</main>
      </body>
    </html>
  );
}
