import { describe, it, expect } from "vitest";
import {
  SANDBOX_BASE_PATH,
  getSandboxHref,
  getSandboxPromptDetailHref,
  getSandboxPromptDiffHref,
  getSandboxReplayHref,
  getSandboxRootHref,
  getSandboxRunDiffHref,
  getSandboxSessionHref,
  isSandboxPath,
} from "./sandbox-routes";

describe("sandbox-routes", () => {
  it("exposes the canonical sandbox base path", () => {
    expect(SANDBOX_BASE_PATH).toBe("/sandbox");
    expect(getSandboxRootHref()).toBe("/sandbox");
  });

  it("builds sandbox hrefs consistently", () => {
    expect(getSandboxHref()).toBe("/sandbox");
    expect(getSandboxHref("/traces")).toBe("/sandbox/traces");
    expect(getSandboxHref("traces")).toBe("/sandbox/traces");
  });

  it("detects canonical sandbox paths only", () => {
    expect(isSandboxPath("/sandbox")).toBe(true);
    expect(isSandboxPath("/sandbox/traces")).toBe(true);
    expect(isSandboxPath("/demo")).toBe(false);
    expect(isSandboxPath("/demo/traces")).toBe(false);
    expect(isSandboxPath("/traces")).toBe(false);
    expect(isSandboxPath(undefined)).toBe(false);
  });

  it("builds prompt detail and diff hrefs for known prompt names", () => {
    expect(getSandboxPromptDetailHref("support-reply")).toBe(
      "/sandbox/prompts/prompt_support_reply",
    );
    expect(getSandboxPromptDiffHref("support-reply", 2, 3)).toBe(
      "/sandbox/prompts/prompt_support_reply/diff?versionA=2&versionB=3",
    );
  });

  it("returns null when prompt routing cannot be built", () => {
    expect(getSandboxPromptDetailHref("unknown-prompt")).toBeNull();
    expect(getSandboxPromptDiffHref("support-reply", 3, 3)).toBeNull();
    expect(getSandboxPromptDiffHref(undefined, 1, 2)).toBeNull();
  });

  it("builds replay, diff, and session hrefs", () => {
    expect(getSandboxReplayHref("trace_123")).toBe("/sandbox/replay/trace_123");
    expect(getSandboxRunDiffHref()).toBe(
      "/sandbox/diff?a=trace_returns_exception_v17_baseline&b=trace_returns_exception_v18_regression",
    );
    expect(getSandboxRunDiffHref("trace_a", "trace_b")).toBe("/sandbox/diff?a=trace_a&b=trace_b");
    expect(getSandboxSessionHref("session_123")).toBe("/sandbox/sessions/session_123");
  });
});
