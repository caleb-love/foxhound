import { type NextRequest, NextResponse } from "next/server";

const API_URL = process.env.FOXHOUND_API_URL ?? "http://localhost:3001";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as unknown;
  const res = await fetch(`${API_URL}/v1/waitlist`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => ({}))) as unknown;
  return NextResponse.json(data, { status: res.status });
}
