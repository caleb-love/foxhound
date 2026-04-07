import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiKeyManager } from "@/app/settings/ApiKeyManager";

vi.mock("@/lib/apikeys", () => ({
  listApiKeys: vi.fn(),
  createApiKey: vi.fn(),
  revokeApiKey: vi.fn(),
}));

import * as apikeys from "@/lib/apikeys";

const MOCK_KEYS: apikeys.ApiKey[] = [
  { id: "k1", prefix: "fox_abc", name: "production", createdAt: "2024-01-15T00:00:00Z" },
  { id: "k2", prefix: "fox_def", name: "staging", createdAt: "2024-02-20T00:00:00Z" },
];

describe("ApiKeyManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Stub window.confirm and window.alert used in component
    vi.stubGlobal("confirm", vi.fn(() => true));
    vi.stubGlobal("alert", vi.fn());
    // Stub clipboard (navigator.clipboard is a getter-only in jsdom)
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  it("renders loading state initially", () => {
    vi.mocked(apikeys.listApiKeys).mockReturnValue(new Promise(() => {}));
    render(<ApiKeyManager />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders error when listApiKeys rejects", async () => {
    vi.mocked(apikeys.listApiKeys).mockRejectedValue(new Error("network error"));
    render(<ApiKeyManager />);
    await waitFor(() =>
      expect(screen.getByText("network error")).toBeInTheDocument(),
    );
  });

  it("renders empty state when no keys exist", async () => {
    vi.mocked(apikeys.listApiKeys).mockResolvedValue([]);
    render(<ApiKeyManager />);
    await waitFor(() =>
      expect(screen.getByText("No API keys yet. Create one above.")).toBeInTheDocument(),
    );
  });

  it("renders key list with name and prefix", async () => {
    vi.mocked(apikeys.listApiKeys).mockResolvedValue(MOCK_KEYS);
    render(<ApiKeyManager />);
    await waitFor(() => {
      expect(screen.getByText("production")).toBeInTheDocument();
      expect(screen.getByText("staging")).toBeInTheDocument();
    });
    expect(screen.getByText("fox_abc…")).toBeInTheDocument();
    expect(screen.getByText("fox_def…")).toBeInTheDocument();
  });

  it("creates a key and reveals it", async () => {
    vi.mocked(apikeys.listApiKeys).mockResolvedValue([]);
    vi.mocked(apikeys.createApiKey).mockResolvedValue({
      key: "fox_secret_key_value",
      meta: { id: "k3", prefix: "fox_sec", name: "ci", createdAt: new Date().toISOString() },
    });

    render(<ApiKeyManager />);
    await waitFor(() => screen.getByPlaceholderText("Key name (e.g. production)"));

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("Key name (e.g. production)"), "ci");
    await user.click(screen.getByRole("button", { name: "Create key" }));

    await waitFor(() =>
      expect(screen.getByText("fox_secret_key_value")).toBeInTheDocument(),
    );
    expect(apikeys.createApiKey).toHaveBeenCalledWith("ci");
  });

  it("shows create error when createApiKey rejects", async () => {
    vi.mocked(apikeys.listApiKeys).mockResolvedValue([]);
    vi.mocked(apikeys.createApiKey).mockRejectedValue(new Error("Name too short"));

    render(<ApiKeyManager />);
    await waitFor(() => screen.getByPlaceholderText("Key name (e.g. production)"));

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("Key name (e.g. production)"), "x");
    await user.click(screen.getByRole("button", { name: "Create key" }));

    await waitFor(() =>
      expect(screen.getByText("Name too short")).toBeInTheDocument(),
    );
  });

  it("does not submit create form when name is blank", async () => {
    vi.mocked(apikeys.listApiKeys).mockResolvedValue([]);
    render(<ApiKeyManager />);
    await waitFor(() => screen.getByRole("button", { name: "Create key" }));

    const form = screen.getByRole("button", { name: "Create key" }).closest("form")!;
    fireEvent.submit(form);

    expect(apikeys.createApiKey).not.toHaveBeenCalled();
  });

  it("revokes a key after confirmation", async () => {
    vi.mocked(apikeys.listApiKeys).mockResolvedValue([...MOCK_KEYS]);
    vi.mocked(apikeys.revokeApiKey).mockResolvedValue(undefined);

    render(<ApiKeyManager />);
    await waitFor(() => screen.getByText("production"));

    const revokeButtons = screen.getAllByRole("button", { name: "Revoke" });
    await userEvent.click(revokeButtons[0]!);

    expect(apikeys.revokeApiKey).toHaveBeenCalledWith("k1");
    await waitFor(() =>
      expect(screen.queryByText("production")).not.toBeInTheDocument(),
    );
  });

  it("does not revoke when confirmation is declined", async () => {
    vi.mocked(window.confirm).mockReturnValue(false);
    vi.mocked(apikeys.listApiKeys).mockResolvedValue([...MOCK_KEYS]);

    render(<ApiKeyManager />);
    await waitFor(() => screen.getByText("production"));

    await userEvent.click(screen.getAllByRole("button", { name: "Revoke" })[0]!);
    expect(apikeys.revokeApiKey).not.toHaveBeenCalled();
  });

  it("copies revealed key to clipboard", async () => {
    vi.mocked(apikeys.listApiKeys).mockResolvedValue([]);
    vi.mocked(apikeys.createApiKey).mockResolvedValue({
      key: "fox_copy_me",
      meta: { id: "k4", prefix: "fox_cop", name: "test", createdAt: new Date().toISOString() },
    });

    render(<ApiKeyManager />);
    await waitFor(() => screen.getByPlaceholderText("Key name (e.g. production)"));

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("Key name (e.g. production)"), "test");
    await user.click(screen.getByRole("button", { name: "Create key" }));

    await waitFor(() => screen.getByText("fox_copy_me"));

    const copyBtn = screen.getByRole("button", { name: "Copy" });
    await user.click(copyBtn);

    // After copy, the button label should change to "Copied!"
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Copied!" })).toBeInTheDocument(),
    );
  });

  it("dismisses the revealed key banner", async () => {
    vi.mocked(apikeys.listApiKeys).mockResolvedValue([]);
    vi.mocked(apikeys.createApiKey).mockResolvedValue({
      key: "fox_dismiss_me",
      meta: { id: "k5", prefix: "fox_dis", name: "dismiss", createdAt: new Date().toISOString() },
    });

    render(<ApiKeyManager />);
    await waitFor(() => screen.getByPlaceholderText("Key name (e.g. production)"));

    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("Key name (e.g. production)"), "dismiss");
    await user.click(screen.getByRole("button", { name: "Create key" }));

    await waitFor(() => screen.getByText("fox_dismiss_me"));
    await user.click(screen.getByRole("button", { name: "Dismiss" }));

    await waitFor(() =>
      expect(screen.queryByText("fox_dismiss_me")).not.toBeInTheDocument(),
    );
  });
});
