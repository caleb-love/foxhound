/**
 * Test-only surface. A thin wrapper used by tests outside this package
 * that want a ClickHouse client pointed at a CI-provided database.
 */
export { createAnalyticsClient, pingAnalytics } from "./client.js";
export { runMigrations } from "./migrate.js";
