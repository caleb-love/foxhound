import { NextResponse } from "next/server";
import { buildLocalReviewDemo } from "@foxhound/demo-domain";

export async function GET() {
  const demo = buildLocalReviewDemo();
  return NextResponse.json({ data: demo.experiments });
}
