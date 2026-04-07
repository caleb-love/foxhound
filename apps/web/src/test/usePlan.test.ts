import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { usePlan } from "@/hooks/usePlan";

describe("usePlan", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function setupFetch(statusBody: unknown, usageBody: unknown) {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(statusBody),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(usageBody),
      } as Response);
  }

  it("starts with loading=true", () => {
    // Fetch never resolves — stays loading
    vi.mocked(fetch).mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => usePlan());
    expect(result.current.loading).toBe(true);
  });

  it("resolves free plan with correct entitlements", async () => {
    setupFetch(
      { plan: "free", period: "monthly", spanCount: 500, nextBillingDate: null },
      { spansUsed: 500, spansLimit: 10000, periodStart: "2024-01-01", periodEnd: "2024-01-31" },
    );

    const { result } = renderHook(() => usePlan());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.plan).toBe("free");
    expect(result.current.canReplay).toBe(false);
    expect(result.current.canRunDiff).toBe(false);
    expect(result.current.spansUsed).toBe(500);
    expect(result.current.spansLimit).toBe(10000);
    expect(result.current.error).toBeNull();
  });

  it("resolves pro plan with replay/diff enabled", async () => {
    setupFetch(
      { plan: "pro", period: "monthly", spanCount: 3000, nextBillingDate: "2024-02-01" },
      { spansUsed: 3000, spansLimit: 500000, periodStart: "2024-01-01", periodEnd: "2024-01-31" },
    );

    const { result } = renderHook(() => usePlan());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.plan).toBe("pro");
    expect(result.current.canReplay).toBe(true);
    expect(result.current.canRunDiff).toBe(true);
  });

  it("resolves enterprise plan with replay/diff enabled", async () => {
    setupFetch(
      { plan: "enterprise", period: "annual", spanCount: 0, nextBillingDate: null },
      { spansUsed: 0, spansLimit: 999999, periodStart: "2024-01-01", periodEnd: "2024-12-31" },
    );

    const { result } = renderHook(() => usePlan());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.canReplay).toBe(true);
    expect(result.current.canRunDiff).toBe(true);
  });

  it("sets error and loading=false when fetch rejects", async () => {
    vi.mocked(fetch).mockRejectedValue(new Error("network down"));

    const { result } = renderHook(() => usePlan());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("network down");
    expect(result.current.plan).toBe("free"); // default unchanged
  });

  it("falls back to defaults when API returns missing fields", async () => {
    setupFetch(
      {}, // no plan field
      {}, // no spansUsed / spansLimit
    );

    const { result } = renderHook(() => usePlan());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.plan).toBe("free");
    expect(result.current.spansUsed).toBe(0);
    expect(result.current.spansLimit).toBe(10000);
  });
});
