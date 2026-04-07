export interface User {
  id: string;
  email: string;
  name: string;
  orgId: string;
  orgName: string;
  orgSlug: string;
}

interface AuthResponse {
  user: { id: string; email: string; name: string };
  org: { id: string; name: string; slug: string };
}

function toUser(r: AuthResponse): User {
  return {
    id: r.user.id,
    email: r.user.email,
    name: r.user.name,
    orgId: r.org.id,
    orgName: r.org.name,
    orgSlug: r.org.slug,
  };
}

export async function login(email: string, password: string): Promise<User> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? "Login failed");
  }
  const data = (await res.json()) as AuthResponse;
  return toUser(data);
}

export async function signup(
  email: string,
  password: string,
  name: string,
  orgName: string,
): Promise<User> {
  const res = await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name, orgName }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? "Signup failed");
  }
  const data = (await res.json()) as AuthResponse;
  return toUser(data);
}

export async function getMe(): Promise<User | null> {
  const res = await fetch("/api/auth/me", { cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    user: { id: string; email: string; name: string };
    org: { id: string; name: string; slug: string } | null;
  } | null;
  if (!data?.org) return null;
  return {
    id: data.user.id,
    email: data.user.email,
    name: data.user.name,
    orgId: data.org.id,
    orgName: data.org.name,
    orgSlug: data.org.slug,
  };
}

export async function logout(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
}
