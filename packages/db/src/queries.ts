/**
 * Compatibility barrel for legacy imports.
 *
 * New query logic should live in one of the domain files instead of this barrel:
 * - queries-auth.ts
 * - queries-traces.ts
 * - queries-evaluators.ts
 * - queries-datasets.ts
 * - queries-prompts.ts
 * - queries-notifications.ts
 * - queries-annotations.ts
 * - queries-platform.ts
 *
 * Keep this file thin to avoid recreating a central query monolith.
 */

export * from "./queries-auth.js";
export * from "./queries-traces.js";
export * from "./queries-evaluators.js";
export * from "./queries-datasets.js";
export * from "./queries-prompts.js";
export * from "./queries-notifications.js";
export * from "./queries-annotations.js";
export * from "./queries-platform.js";
