const API_URL = process.env.FOXHOUND_API_URL ?? "http://localhost:3001";

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

async function authedFetch(
  url: string,
  token: string,
  options: RequestInit = {},
): Promise<Response> {
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers as Record<string, string> | undefined),
    },
  });
}

export async function listApiKeys(token: string): Promise<ApiKey[]> {
  const res = await authedFetch(`${API_URL}/v1/api-keys`, token);
  if (!res.ok) throw new Error(`Failed to list API keys: ${res.status}`);
  const data = (await res.json()) as { data: ApiKey[] };
  return data.data;
}

export async function createApiKey(
  token: string,
  name: string,
): Promise<CreateApiKeyResult> {
  const res = await authedFetch(`${API_URL}/v1/api-keys`, token, {
    method: "POST",
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

export async function revokeApiKey(token: string, id: string): Promise<void> {
  const res = await authedFetch(`${API_URL}/v1/api-keys/${encodeURIComponent(id)}`, token, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`Failed to revoke API key: ${res.status}`);
}
