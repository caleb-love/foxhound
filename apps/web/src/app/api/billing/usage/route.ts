import { NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_URL = process.env.FOXHOUND_API_URL ?? "http://localhost:3001";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get("fox_token")?.value;
  if (!token) return NextResponse.json(null, { status: 401 });

  const res = await fetch(`${API_URL}/v1/billing/usage`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  const data = (await res.json().catch(() => null)) as unknown;
  return NextResponse.json(data, { status: res.status });
}
