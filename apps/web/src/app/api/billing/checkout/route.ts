import { NextResponse } from "next/server";

// Billing is disabled for self-hosted open-source deployments.
export async function POST() {
  return NextResponse.json({ error: "Billing not available" }, { status: 503 });
}
