import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

const API_URL = process.env.FOXHOUND_API_URL ?? "http://localhost:3001";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const cookieStore = await cookies();
  const token = cookieStore.get("fox_token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const res = await fetch(`${API_URL}/v1/api-keys/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as unknown;
    return NextResponse.json(data, { status: res.status });
  }
  return new NextResponse(null, { status: 204 });
}
