export { getEntitlements, invalidateEntitlements } from "./entitlements.js";
export type { Entitlements, Plan } from "./entitlements.js";
export { checkSpanLimit, incrementSpanCount, currentBillingPeriod, periodBounds } from "./metering.js";
export type { SpanLimitCheck } from "./metering.js";
