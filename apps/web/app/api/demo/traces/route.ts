/**
 * Demo API endpoint for testing the dashboard without a real API server.
 * Uses the shared demo-domain package so web demo mode can later share the same
 * narrative data as the marketing-site interactive demo.
 */

import { NextResponse } from "next/server";
import { buildLocalReviewDemo } from "@foxhound/demo-domain";

export async function GET() {
  const demo = buildLocalReviewDemo();
  const traces = demo.allTraces;

  return NextResponse.json({
    data: traces,
    pagination: {
      page: 1,
      limit: traces.length,
      count: traces.length,
    },
  });
}
