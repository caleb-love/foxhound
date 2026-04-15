export interface ApiHttpClientConfig {
  endpoint: string;
  apiKey: string;
}

function normalizeEndpoint(endpoint: string): string {
  let normalized = endpoint;
  while (normalized.endsWith("/")) normalized = normalized.slice(0, -1);

  if (
    !normalized.startsWith("https://") &&
    !/^http:\/\/(localhost|127\.0\.0\.1)(:|$)/.test(normalized)
  ) {
    throw new Error(
      "Non-localhost endpoints must use HTTPS. Use https:// or connect to localhost for development.",
    );
  }

  return normalized;
}

export function createApiHttpClient(config: ApiHttpClientConfig) {
  const endpoint = normalizeEndpoint(config.endpoint);
  const apiKey = config.apiKey;

  function authHeaders(includeJsonContentType = false): Record<string, string> {
    return {
      ...(includeJsonContentType ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    };
  }

  async function parseJsonResponse<T>(response: Response, errorPrefix = "Foxhound API"): Promise<T> {
    if (!response.ok) {
      const raw = await response.text().catch(() => "");
      const text = raw.length > 500 ? `${raw.slice(0, 500)}…` : raw;
      throw new Error(`${errorPrefix} ${response.status}: ${text || response.statusText}`);
    }

    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  async function request<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    body?: Record<string, unknown>,
    options?: { errorPrefix?: string },
  ): Promise<T> {
    const init: RequestInit = {
      method,
      headers: authHeaders(body !== undefined),
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    };

    const response = await fetch(`${endpoint}${path}`, init);
    return parseJsonResponse<T>(response, options?.errorPrefix ?? "Foxhound API");
  }

  return {
    endpoint,
    apiKey,
    authHeaders,
    parseJsonResponse,
    request,
  };
}
