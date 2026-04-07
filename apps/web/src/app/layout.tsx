import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Fox Platform",
  description: "Compliance-grade observability for AI agent fleets",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
