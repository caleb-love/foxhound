const API_URL = process.env.FOXHOUND_API_URL ?? "http://localhost:3001";

export interface User {
  id: string;
  email: string;
  name: string;
  orgId: string;
  orgName: string;
  orgSlug: string;
}

interface AuthResponse {
  token: string;
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

/** Set the session token in a cookie accessible to Next.js middleware. */
export function setToken(token: string): void {
  const maxAge = 60 * 60 * 24 * 30; // 30 days
  document.cookie = `fox_token=${token}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

/** Clear the session token cookie. */
export function clearToken(): void {
  document.cookie = "fox_token=; path=/; max-age=0";
}

/** Read the session token from cookies (works in browser context). */
export function getToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)fox_token=([^;]+)/);
  return match ? (match[1] ?? null) : null;
}

export async function login(email: string, password: string): Promise<User> {
  const res = await fetch(`${API_URL}/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? "Login failed");
  }
  const data = (await res.json()) as AuthResponse;
  setToken(data.token);
  return toUser(data);
}

export async function signup(
  email: string,
  password: string,
  name: string,
  orgName: string,
): Promise<User> {
  const res = await fetch(`${API_URL}/v1/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name, orgName }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? "Signup failed");
  }
  const data = (await res.json()) as AuthResponse;
  setToken(data.token);
  return toUser(data);
}

export async function getMe(token: string): Promise<User | null> {
  const res = await fetch(`${API_URL}/v1/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (res.status === 401 || res.status === 404) return null;
  if (!res.ok) return null;
  const data = (await res.json()) as {
    user: { id: string; email: string; name: string };
    org: { id: string; name: string; slug: string } | null;
  };
  if (!data.org) return null;
  return {
    id: data.user.id,
    email: data.user.email,
    name: data.user.name,
    orgId: data.org.id,
    orgName: data.org.name,
    orgSlug: data.org.slug,
  };
}

export function logout(): void {
  clearToken();
}
