import { NextResponse } from "next/server";
import { buildLocalReviewDemo } from "@foxhound/demo-domain";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const demo = buildLocalReviewDemo();
  const trace =
    demo.allTraces.find((item: (typeof demo.allTraces)[number]) => item.id === id) ??
    demo.curatedTraces.find((item: (typeof demo.curatedTraces)[number]) => item.id === id)?.trace;

  if (!trace) {
    return NextResponse.json({ error: "Trace not found" }, { status: 404 });
  }

  return NextResponse.json(trace);
}
