export interface ApiHttpClientConfig {
  endpoint: string;
  apiKey: string;
  /** Maximum retry attempts for transient failures (default: 2) */
  maxRetries?: number;
  /** Request timeout in milliseconds (default: 30000) */
  timeoutMs?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getBackoffMs(attempt: number): number {
  // Exponential backoff: 500ms, 1500ms, 3500ms, capped at 5000ms
  const base = 500;
  const delay = base * Math.pow(2, attempt) + Math.random() * 200;
  return Math.min(delay, 5000);
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
  const maxRetries = config.maxRetries ?? 2;
  const timeoutMs = config.timeoutMs ?? 30000;

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
      signal: timeoutMs > 0 ? AbortSignal.timeout(timeoutMs) : undefined,
    };

    let lastError: Error | undefined;
    const attempts = maxRetries + 1;

    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        const response = await fetch(`${endpoint}${path}`, init);

        // Do not retry client errors (4xx), only server/network errors
        if (response.status >= 400 && response.status < 500) {
          return parseJsonResponse<T>(response, options?.errorPrefix ?? "Foxhound API");
        }

        // Retry on 5xx
        if (response.status >= 500 && attempt < attempts - 1) {
          lastError = new Error(`${options?.errorPrefix ?? "Foxhound API"} ${response.status}`);
          await sleep(getBackoffMs(attempt));
          continue;
        }

        return parseJsonResponse<T>(response, options?.errorPrefix ?? "Foxhound API");
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        // Do not retry abort/timeout or if out of attempts
        if (lastError.name === "AbortError" || lastError.name === "TimeoutError" || attempt >= attempts - 1) {
          throw lastError;
        }

        await sleep(getBackoffMs(attempt));
      }
    }

    throw lastError ?? new Error("Request failed after retries");
  }

  return {
    endpoint,
    apiKey,
    authHeaders,
    parseJsonResponse,
    request,
  };
}
