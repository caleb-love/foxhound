import { describe, it, expect } from "vitest";
import {
  DEFAULT_REDACTED_KEYS,
  DEFAULT_REDACTION_POLICY,
  redactAttributes,
} from "./redaction.js";

describe("redactAttributes", () => {
  it("redacts keys flagged by default policy", () => {
    const out = redactAttributes({
      api_key: "sk-123",
      Authorization: "Bearer t",
      PASSWORD: "p",
      token: "t",
      session_id: "s",
      cookie: "c",
      credit_card: "1234",
      ssn: "999",
      secret: "x",
      safe: "ok",
    });
    expect(out["api_key"]).toBe("[REDACTED]");
    expect(out["Authorization"]).toBe("[REDACTED]");
    expect(out["PASSWORD"]).toBe("[REDACTED]");
    expect(out["token"]).toBe("[REDACTED]");
    expect(out["session_id"]).toBe("[REDACTED]");
    expect(out["cookie"]).toBe("[REDACTED]");
    expect(out["credit_card"]).toBe("[REDACTED]");
    expect(out["ssn"]).toBe("[REDACTED]");
    expect(out["secret"]).toBe("[REDACTED]");
    expect(out["safe"]).toBe("ok");
  });

  it("matches case-insensitively on substrings", () => {
    const out = redactAttributes({ "X-API-KEY-Header": "v", user_token_v2: "v" });
    expect(out["X-API-KEY-Header"]).toBe("[REDACTED]");
    expect(out["user_token_v2"]).toBe("[REDACTED]");
  });

  it("does not mutate the input", () => {
    const input = { api_key: "sk-1", safe: "ok" };
    const out = redactAttributes(input);
    expect(input.api_key).toBe("sk-1");
    expect(out).not.toBe(input);
  });

  it("accepts a custom policy with different keys + replacement", () => {
    const out = redactAttributes(
      { internal_id: "abc", safe: "ok" },
      { keys: new Set(["internal_id"]), replacement: "***" },
    );
    expect(out["internal_id"]).toBe("***");
    expect(out["safe"]).toBe("ok");
  });

  it("exports the default policy and its key set", () => {
    expect(DEFAULT_REDACTION_POLICY.replacement).toBe("[REDACTED]");
    expect(DEFAULT_REDACTED_KEYS.has("api_key")).toBe(true);
  });
});
