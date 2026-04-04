export type BlogIncidentOwner =
  | "draft-approval"
  | "publish-pipeline"
  | "publish-verify"
  | "verifier"
  | "harness"
  | "operations"
  | "ceo"
  | "research-draft"
  | "editorial"
  | "owning-specialist";

export type BlogIncidentFailureName =
  | "APPROVAL_FAILURE"
  | "IDEMPOTENCY_ANOMALY"
  | "PUBLISH_BOUNDARY_MISMATCH"
  | "PUBLIC_VERIFY_FAILURE"
  | "BACKUP_DELAY"
  | "EARLY_COST_ANOMALY"
  | "RESEARCH_QUALITY_WOBBLE"
  | "ROUTINE_PARTIAL_FAILURE";

export type BlogIncidentRoute = {
  primaryOwner: BlogIncidentOwner;
  supportingOwners: BlogIncidentOwner[];
  escalationOwner: BlogIncidentOwner;
  followUpTrack: string;
};

export const BLOG_INCIDENT_OWNER_MAP: Record<BlogIncidentOwner, { team: string; escalationDefault: BlogIncidentOwner | null }> = {
  "draft-approval": { team: "draft", escalationDefault: "ceo" },
  "publish-pipeline": { team: "publish", escalationDefault: "operations" },
  "publish-verify": { team: "publish", escalationDefault: "operations" },
  verifier: { team: "verify", escalationDefault: "operations" },
  harness: { team: "harness", escalationDefault: "operations" },
  operations: { team: "operations", escalationDefault: "ceo" },
  ceo: { team: "executive", escalationDefault: null },
  "research-draft": { team: "research", escalationDefault: "editorial" },
  editorial: { team: "editorial", escalationDefault: "ceo" },
  "owning-specialist": { team: "specialist", escalationDefault: "operations" },
};

export const BLOG_INCIDENT_OWNER_ROUTING: Record<BlogIncidentFailureName, BlogIncidentRoute> = {
  APPROVAL_FAILURE: {
    primaryOwner: "draft-approval",
    supportingOwners: ["publish-pipeline"],
    escalationOwner: "ceo",
    followUpTrack: "draft-approval",
  },
  IDEMPOTENCY_ANOMALY: {
    primaryOwner: "publish-pipeline",
    supportingOwners: ["operations"],
    escalationOwner: "operations",
    followUpTrack: "publish-pipeline",
  },
  PUBLISH_BOUNDARY_MISMATCH: {
    primaryOwner: "publish-pipeline",
    supportingOwners: ["harness"],
    escalationOwner: "operations",
    followUpTrack: "publish-boundary",
  },
  PUBLIC_VERIFY_FAILURE: {
    primaryOwner: "publish-verify",
    supportingOwners: ["verifier", "harness"],
    escalationOwner: "operations",
    followUpTrack: "public-verify",
  },
  BACKUP_DELAY: {
    primaryOwner: "operations",
    supportingOwners: ["harness"],
    escalationOwner: "operations",
    followUpTrack: "backup-recovery",
  },
  EARLY_COST_ANOMALY: {
    primaryOwner: "operations",
    supportingOwners: ["ceo"],
    escalationOwner: "ceo",
    followUpTrack: "cost-ops",
  },
  RESEARCH_QUALITY_WOBBLE: {
    primaryOwner: "research-draft",
    supportingOwners: ["editorial"],
    escalationOwner: "editorial",
    followUpTrack: "editorial-repair",
  },
  ROUTINE_PARTIAL_FAILURE: {
    primaryOwner: "owning-specialist",
    supportingOwners: ["operations"],
    escalationOwner: "operations",
    followUpTrack: "routine-recovery",
  },
};

export function resolveBlogIncidentRoute(failureName: BlogIncidentFailureName): BlogIncidentRoute {
  return BLOG_INCIDENT_OWNER_ROUTING[failureName];
}
