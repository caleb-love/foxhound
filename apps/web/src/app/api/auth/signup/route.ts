import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_URL = process.env.FOXHOUND_API_URL ?? "http://localhost:3001";

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  maxAge: 60 * 60 * 24 * 30, // 30 days
  path: "/",
};

export async function POST(request: NextRequest) {
  const body = (await request.json()) as unknown;
  const res = await fetch(`${API_URL}/v1/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    return NextResponse.json(data, { status: res.status });
  }

  const cookieStore = await cookies();
  cookieStore.set("fox_token", String(data.token ?? ""), COOKIE_OPTS);

  return NextResponse.json({ user: data.user, org: data.org });
}
