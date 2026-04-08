import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_URL = process.env.FOXHOUND_API_URL ?? "http://localhost:3001";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("fox_token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const res = await fetch(`${API_URL}/v1/notifications/rules`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const data = (await res.json().catch(() => ({}))) as unknown;
  return NextResponse.json(data, { status: res.status });
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get("fox_token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as unknown;
  const res = await fetch(`${API_URL}/v1/notifications/rules`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => ({}))) as unknown;
  return NextResponse.json(data, { status: res.status });
}
