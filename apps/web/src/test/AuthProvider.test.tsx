import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "@/components/AuthProvider";

// Mock the auth lib
vi.mock("@/lib/auth", () => ({
  getMe: vi.fn(),
  logout: vi.fn(),
}));

import * as authLib from "@/lib/auth";

function TestConsumer() {
  const { user, loading } = useAuth();
  if (loading) return <div>loading</div>;
  if (!user) return <div>no user</div>;
  return <div>user:{user.email}</div>;
}

function LogoutConsumer() {
  const { logout } = useAuth();
  return <button onClick={logout}>logout</button>;
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom doesn't implement location assignment fully — stub it
    Object.defineProperty(window, "location", {
      writable: true,
      value: { href: "" },
    });
  });

  it("starts in loading state", () => {
    vi.mocked(authLib.getMe).mockReturnValue(new Promise(() => {})); // never resolves
    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );
    expect(screen.getByText("loading")).toBeInTheDocument();
  });

  it("populates user when getMe resolves", async () => {
    vi.mocked(authLib.getMe).mockResolvedValue({
      id: "u1",
      email: "alice@example.com",
      name: "Alice",
      orgId: "org1",
      orgName: "Acme",
      orgSlug: "acme",
    });

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText("user:alice@example.com")).toBeInTheDocument(),
    );
  });

  it("shows no user when getMe rejects", async () => {
    vi.mocked(authLib.getMe).mockRejectedValue(new Error("unauthorized"));

    render(
      <AuthProvider>
        <TestConsumer />
      </AuthProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText("no user")).toBeInTheDocument(),
    );
  });

  it("calls logout lib and redirects on logout()", async () => {
    vi.mocked(authLib.getMe).mockResolvedValue(null as unknown as Awaited<ReturnType<typeof authLib.getMe>>);
    vi.mocked(authLib.logout).mockResolvedValue(undefined);

    render(
      <AuthProvider>
        <LogoutConsumer />
      </AuthProvider>,
    );

    await act(async () => {
      screen.getByText("logout").click();
      await Promise.resolve(); // flush microtasks
    });

    await waitFor(() => {
      expect(authLib.logout).toHaveBeenCalledOnce();
    });
    await waitFor(() => {
      expect(window.location.href).toBe("/login");
    });
  });

  it("provides default context outside AuthProvider (no throw)", () => {
    // useAuth should return safe defaults when used outside a provider
    // The default context has user:null, loading:true
    function Bare() {
      const ctx = useAuth();
      return <div>{ctx.loading ? "loading" : "ready"}</div>;
    }
    render(<Bare />);
    expect(screen.getByText("loading")).toBeInTheDocument();
  });
});
