import { describe, it, expect, vi, afterEach } from "vitest";
import type { FastifyRequest, FastifyReply } from "fastify";

vi.mock("@foxhound/billing", () => ({
  getEntitlements: vi.fn(),
}));

import { getEntitlements } from "@foxhound/billing";
import { requireEntitlement } from "./entitlements.js";

function mockRequest(orgId: string) {
  return { orgId } as FastifyRequest;
}

function mockReply() {
  const reply = {
    code: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  } as unknown as FastifyReply;
  return reply;
}

describe("requireEntitlement", () => {
  const originalEnv = process.env["FOXHOUND_CLOUD"];

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env["FOXHOUND_CLOUD"];
    } else {
      process.env["FOXHOUND_CLOUD"] = originalEnv;
    }
    vi.clearAllMocks();
  });

  it("passes through in self-hosted mode (no FOXHOUND_CLOUD)", async () => {
    delete process.env["FOXHOUND_CLOUD"];
    const handler = requireEntitlement("canReplay");
    const reply = mockReply();

    await handler(mockRequest("org_1"), reply);

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(reply.code).not.toHaveBeenCalled();
  });

  it("allows access when entitlement is granted in cloud mode", async () => {
    process.env["FOXHOUND_CLOUD"] = "1";
    vi.mocked(getEntitlements).mockResolvedValue({
      canReplay: true,
      canRunDiff: true,
      canAuditLog: false,
      canEvaluate: false,
      maxSpans: 100_000,
      maxProjects: -1,
      maxSeats: -1,
      retentionDays: 30,
    });

    const handler = requireEntitlement("canReplay");
    const reply = mockReply();

    await handler(mockRequest("org_1"), reply);

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(reply.code).not.toHaveBeenCalled();
  });

  it("returns 403 when entitlement is denied in cloud mode", async () => {
    process.env["FOXHOUND_CLOUD"] = "1";
    vi.mocked(getEntitlements).mockResolvedValue({
      canReplay: false,
      canRunDiff: false,
      canAuditLog: false,
      canEvaluate: false,
      maxSpans: 100_000,
      maxProjects: -1,
      maxSeats: -1,
      retentionDays: 30,
    });

    const handler = requireEntitlement("canAuditLog");
    const reply = mockReply();

    await handler(mockRequest("org_1"), reply);

    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(reply.code).toHaveBeenCalledWith(403);
  });
});
