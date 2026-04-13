/**
 * Internal DB functions for trusted callers (worker process only).
 *
 * These functions do NOT scope by org_id and must NOT be imported in API routes.
 * API routes should import from "@foxhound/db" which only exposes org-scoped queries.
 *
 * Use "@foxhound/db/internal" to access these functions in worker code.
 */

export { getEvaluatorById, getEvaluatorRun } from "./queries.js";
