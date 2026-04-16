import { describe, it, expect, vi, beforeEach } from "vitest";

const redirectMock = vi.fn();
const getServerSessionMock = vi.fn();

vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => redirectMock(...args),
}));

vi.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => getServerSessionMock(...args),
}));

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}));

describe("sandbox auth helpers", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env["FOXHOUND_UI_DEMO_MODE"];
  });

  it("reports sandbox mode when env flag is true", async () => {
    process.env["FOXHOUND_UI_DEMO_MODE"] = "true";
    const mod = await import("./sandbox-auth");
    expect(mod.isDashboardSandboxModeEnabled()).toBe(true);
  });

  it("returns a sandbox session when sandbox mode is enabled and no real session exists", async () => {
    process.env["FOXHOUND_UI_DEMO_MODE"] = "true";
    getServerSessionMock.mockResolvedValue(null);
    const mod = await import("./sandbox-auth");

    const session = await mod.getDashboardSessionOrSandbox();
    expect(session.user.name).toBe("Sandbox Operator");
    expect(session.user.token).toBe("sandbox-token");
  });

  it("redirects to login when sandbox mode is off and no session exists", async () => {
    getServerSessionMock.mockResolvedValue(null);
    const mod = await import("./sandbox-auth");

    await mod.getDashboardSessionOrSandbox();
    expect(redirectMock).toHaveBeenCalledWith("/login");
  });
});
