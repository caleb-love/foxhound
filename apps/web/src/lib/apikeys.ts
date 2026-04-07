export interface ApiKey {
  id: string;
  prefix: string;
  name: string;
  createdAt: string;
}

export interface CreateApiKeyResult {
  key: string;
  meta: ApiKey;
}

export async function listApiKeys(): Promise<ApiKey[]> {
  const res = await fetch("/api/keys", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to list API keys: ${res.status}`);
  const data = (await res.json()) as { data: ApiKey[] };
  return data.data;
}

export async function createApiKey(name: string): Promise<CreateApiKeyResult> {
  const res = await fetch("/api/keys", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? `Failed to create API key: ${res.status}`);
  }
  const data = (await res.json()) as ApiKey & { key: string };
  return {
    key: data.key,
    meta: { id: data.id, prefix: data.prefix, name: data.name, createdAt: data.createdAt },
  };
}

export async function revokeApiKey(id: string): Promise<void> {
  const res = await fetch(`/api/keys/${encodeURIComponent(id)}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Failed to revoke API key: ${res.status}`);
}
