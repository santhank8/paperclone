/**
 * Contract test: Agent API keys cannot access other companies.
 *
 * Verifies the assertCompanyAccess function correctly enforces the
 * agent-company boundary at the authz layer.
 */
import { describe, expect, it } from "vitest";
import { assertCompanyAccess, assertBoard } from "../routes/authz.js";
import type { Request } from "express";

function fakeReq(actor: any): Request {
  return { actor } as unknown as Request;
}

describe("agent auth company boundary contract", () => {
  it("agent with companyId=A cannot access companyId=B", () => {
    const req = fakeReq({
      type: "agent",
      agentId: "agent-1",
      companyId: "company-A",
    });
    expect(() => assertCompanyAccess(req, "company-B")).toThrow(
      "Agent key cannot access another company",
    );
  });

  it("agent with companyId=A can access companyId=A", () => {
    const req = fakeReq({
      type: "agent",
      agentId: "agent-1",
      companyId: "company-A",
    });
    expect(() => assertCompanyAccess(req, "company-A")).not.toThrow();
  });

  it("assertBoard rejects agent actors", () => {
    const req = fakeReq({
      type: "agent",
      agentId: "agent-1",
      companyId: "company-A",
    });
    expect(() => assertBoard(req)).toThrow("Board access required");
  });

  it("assertBoard accepts board actors", () => {
    const req = fakeReq({
      type: "board",
      userId: "user-1",
      source: "local_implicit",
    });
    expect(() => assertBoard(req)).not.toThrow();
  });
});
