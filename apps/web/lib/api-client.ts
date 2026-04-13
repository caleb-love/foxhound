/**
 * API client wrapper for the Foxhound dashboard
 */

import { FoxhoundApiClient } from "@foxhound/api-client";

const API_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

/**
 * Create an authenticated client with a bearer token
 */
export function getAuthenticatedClient(token: string) {
  return new FoxhoundApiClient({
    endpoint: API_URL,
    apiKey: token,
  });
}
