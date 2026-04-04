import { describe, expect, it } from "vitest";
import {
  BLOG_INCIDENT_OWNER_MAP,
  BLOG_INCIDENT_OWNER_ROUTING,
  resolveBlogIncidentRoute,
} from "../services/blog-incident-routing.ts";

describe("blog incident routing", () => {
  it("defines the required owner map entries", () => {
    expect(BLOG_INCIDENT_OWNER_MAP.operations.team).toBe("operations");
    expect(BLOG_INCIDENT_OWNER_MAP.operations.escalationDefault).toBe("ceo");
    expect(BLOG_INCIDENT_OWNER_MAP["publish-pipeline"].team).toBe("publish");
    expect(BLOG_INCIDENT_OWNER_MAP.verifier.team).toBe("verify");
    expect(BLOG_INCIDENT_OWNER_MAP.harness.team).toBe("harness");
    expect(BLOG_INCIDENT_OWNER_MAP.ceo.team).toBe("executive");
  });

  it("routes each failure family to a primary and escalation owner", () => {
    expect(resolveBlogIncidentRoute("APPROVAL_FAILURE")).toMatchObject({
      primaryOwner: "draft-approval",
      escalationOwner: "ceo",
      followUpTrack: "draft-approval",
    });
    expect(resolveBlogIncidentRoute("PUBLIC_VERIFY_FAILURE")).toMatchObject({
      primaryOwner: "publish-verify",
      escalationOwner: "operations",
      supportingOwners: ["verifier", "harness"],
      followUpTrack: "public-verify",
    });
    expect(resolveBlogIncidentRoute("EARLY_COST_ANOMALY")).toMatchObject({
      primaryOwner: "operations",
      escalationOwner: "ceo",
      followUpTrack: "cost-ops",
    });
  });

  it("keeps every route in the explicit routing table", () => {
    expect(Object.keys(BLOG_INCIDENT_OWNER_ROUTING).sort()).toEqual([
      "APPROVAL_FAILURE",
      "BACKUP_DELAY",
      "EARLY_COST_ANOMALY",
      "IDEMPOTENCY_ANOMALY",
      "PUBLIC_VERIFY_FAILURE",
      "PUBLISH_BOUNDARY_MISMATCH",
      "RESEARCH_QUALITY_WOBBLE",
      "ROUTINE_PARTIAL_FAILURE",
    ]);
  });
});
