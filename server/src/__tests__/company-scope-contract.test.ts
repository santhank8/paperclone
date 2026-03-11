/**
 * Contract test: Company-scope boundary enforcement.
 *
 * Verifies that assertCompanyAccess correctly denies cross-company access
 * for agent actors and non-member board actors.
 */
import { describe, expect, it } from "vitest";
import { assertCompanyAccess } from "../routes/authz.js";
import type { Request } from "express";

function fakeReq(actor: any): Request {
  return { actor } as unknown as Request;
}

describe("company-scope contract", () => {
  it("allows agent access to own company", () => {
    const req = fakeReq({
      type: "agent",
      agentId: "agent-1",
      companyId: "company-1",
    });
    expect(() => assertCompanyAccess(req, "company-1")).not.toThrow();
  });

  it("denies agent access to another company", () => {
    const req = fakeReq({
      type: "agent",
      agentId: "agent-1",
      companyId: "company-1",
    });
    expect(() => assertCompanyAccess(req, "company-2")).toThrow(
      "Agent key cannot access another company",
    );
  });

  it("allows local_implicit board access to any company", () => {
    const req = fakeReq({
      type: "board",
      userId: "board",
      source: "local_implicit",
    });
    expect(() => assertCompanyAccess(req, "any-company")).not.toThrow();
  });

  it("allows authenticated board access to member company", () => {
    const req = fakeReq({
      type: "board",
      userId: "user-1",
      source: "session",
      companyIds: ["company-1", "company-2"],
    });
    expect(() => assertCompanyAccess(req, "company-1")).not.toThrow();
  });

  it("denies authenticated board access to non-member company", () => {
    const req = fakeReq({
      type: "board",
      userId: "user-1",
      source: "session",
      companyIds: ["company-1"],
    });
    expect(() => assertCompanyAccess(req, "company-99")).toThrow(
      "User does not have access to this company",
    );
  });

  it("allows instance admin board access to any company", () => {
    const req = fakeReq({
      type: "board",
      userId: "admin-1",
      source: "session",
      isInstanceAdmin: true,
      companyIds: [],
    });
    expect(() => assertCompanyAccess(req, "any-company")).not.toThrow();
  });

  it("denies unauthenticated access", () => {
    const req = fakeReq({ type: "none" });
    expect(() => assertCompanyAccess(req, "company-1")).toThrow();
  });
});
