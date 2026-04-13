/**
 * Demo API endpoint for a single trace
 */

import { NextResponse } from "next/server";
import { DEMO_TRACES } from "@/lib/demo-data-advanced";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Find trace by ID from the generated demo data
  const trace = DEMO_TRACES.find((t) => t.id === id);

  if (!trace) {
    return NextResponse.json({ error: "Trace not found" }, { status: 404 });
  }

  return NextResponse.json(trace);
}
