import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { NavClient } from "@/components/NavClient";

export const metadata: Metadata = {
  title: "Foxhound — AI Agent Observability",
  description:
    "Compliance-grade observability for AI agent fleets. Trace, replay, and audit every agent decision.",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico" },
    ],
    apple: { url: "/apple-touch-icon.png", sizes: "180x180" },
  },
  openGraph: {
    title: "Foxhound — AI Agent Observability",
    description:
      "Compliance-grade observability for AI agent fleets. Trace, replay, and audit every agent decision.",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Foxhound — AI Agent Observability",
    description: "Compliance-grade observability for AI agent fleets.",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
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
              <img
                src="/logo.png"
                alt="Foxhound"
                width={28}
                height={28}
                style={{ borderRadius: 6 }}
              />
              Foxhound
            </a>
            <a href="/traces" className="nav-link">
              Traces
            </a>
            <a href="/pricing" className="nav-link">
              Pricing
            </a>
            <NavClient />
          </nav>
          <main style={{ minHeight: "calc(100vh - 48px)" }}>{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
