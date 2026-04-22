/**
 * Fox DB — database client, schema definitions, and org-scoped query modules.
 *
 * Prefer adding and reading queries by domain module:
 * - queries-auth
 * - queries-traces
 * - queries-evaluators
 * - queries-datasets
 * - queries-prompts
 * - queries-notifications
 * - queries-annotations
 * - queries-platform
 *
 * `queries.ts` remains as a compatibility barrel, but should not be the default
 * place for new query logic.
 */

export { db } from "./client.js";
export * from "./schema.js";
export * from "./queries-auth.js";
export * from "./queries-traces.js";
export * from "./queries-evaluators.js";
export * from "./queries-datasets.js";
export * from "./queries-prompts.js";
export * from "./queries-notifications.js";
export * from "./queries-annotations.js";
export * from "./queries-platform.js";
export * from "./queries-pricing.js";
