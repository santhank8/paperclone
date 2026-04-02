import { describe, expect, it } from "vitest";
import { buildVirtualOrgPolicySnapshot, defaultAllowedActionsForStage } from "./policy.js";

describe("virtual org policy", () => {
  it("uses discovery actions by default", () => {
    expect(defaultAllowedActionsForStage("discovery")).toEqual([
      "research",
      "positioning",
      "messaging",
      "experiments",
    ]);
  });

  it("builds a stable policy snapshot", () => {
    expect(buildVirtualOrgPolicySnapshot({
      companyId: "company-1",
      stage: "growth",
      approvalRequired: true,
      executionTarget: "manual_review",
      allowedRepos: ["repo-a"],
      connectedTools: ["slack"],
    })).toEqual({
      companyId: "company-1",
      stage: "growth",
      allowedActions: ["analysis", "reporting", "monitoring", "recommendations"],
      approvalRequired: true,
      executionTarget: "manual_review",
      allowedRepos: ["repo-a"],
      connectedTools: ["slack"],
    });
  });
});
