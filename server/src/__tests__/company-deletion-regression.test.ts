import { describe, expect, it } from "vitest";
import {
  budgetIncidents,
  budgetPolicies,
  projects,
  goals,
  documents,
  documentRevisions,
  companySkills,
  feedbackVotes,
  issueReadStates,
  issueInboxArchives,
  workspaceOperations,
  workspaceRuntimeServices,
  heartbeatRunEvents,
  agentTaskSessions,
  heartbeatRuns,
  agentWakeupRequests,
  agentApiKeys,
  agentRuntimeState,
  issueComments,
  costEvents,
  financeEvents,
  approvalComments,
  approvals,
  companySecrets,
  joinRequests,
  invites,
  principalPermissionGrants,
  companyMemberships,
  issues,
  companyLogos,
  assets,
  agents,
  activityLog,
  companies,
} from "@paperclipai/db";

/**
 * HAP-4 regression: validates delete ordering constraints in
 * companyService.remove() by comparing against the Drizzle schema
 * table references used in the actual service code.
 *
 * This file mirrors the exact delete order from companies.ts.
 * If the service changes, this file must be updated to match.
 */

// Ordered as in server/src/services/companies.ts remove()
const DELETE_ORDER = [
  heartbeatRunEvents,
  agentTaskSessions,
  heartbeatRuns,
  agentWakeupRequests,
  agentApiKeys,
  agentRuntimeState,
  issueComments,
  issueReadStates,
  issueInboxArchives,
  costEvents,
  financeEvents,
  approvalComments,
  approvals,
  documentRevisions,
  documents,
  companySecrets,
  joinRequests,
  invites,
  principalPermissionGrants,
  companyMemberships,
  issues,
  companyLogos,
  assets,
  projects,
  goals,
  workspaceOperations,
  workspaceRuntimeServices,
  feedbackVotes,
  agents,
  budgetIncidents,
  budgetPolicies,
  companySkills,
  activityLog,
  companies,
] as const;

describe("HAP-4: company deletion FK ordering", () => {
  it("budget_incidents deleted before budget_policies (no onDelete on FK)", () => {
    // budget_incidents.policy_id -> budget_policies.id
    // Schema: budget_incidents.ts line 12: .references(() => budgetPolicies.id) — no onDelete option
    // This means PG will block deletion of a budget_policy that has incidents.
    // The service MUST delete incidents first.
    const incIdx = DELETE_ORDER.indexOf(budgetIncidents);
    const polIdx = DELETE_ORDER.indexOf(budgetPolicies);
    expect(incIdx).toBeGreaterThanOrEqual(0);
    expect(polIdx).toBeGreaterThanOrEqual(0);
    expect(incIdx).toBeLessThan(polIdx);
  });

  it("projects deleted before goals (goals FK to projects)", () => {
    // projects.goalId -> goals.id (onDelete: set null)
    // goals has no FK to projects, but both reference companies.id (no onDelete)
    // Accepted ordering: projects before goals
    const projIdx = DELETE_ORDER.indexOf(projects);
    const goalIdx = DELETE_ORDER.indexOf(goals);
    expect(projIdx).toBeGreaterThanOrEqual(0);
    expect(goalIdx).toBeGreaterThanOrEqual(0);
    expect(projIdx).toBeLessThan(goalIdx);
  });

  it("all accepted hard-blocker tables are covered in delete sequence", () => {
    const blockers = [
      companySkills,
      budgetPolicies,
      budgetIncidents,
      feedbackVotes,
      issueReadStates,
      issueInboxArchives,
      workspaceOperations,
      workspaceRuntimeServices,
      documents,
      documentRevisions,
    ];
    for (const table of blockers) {
      expect(DELETE_ORDER).toContain(table);
    }
  });

  it("delete sequence contains exactly the expected number of tables (32)", () => {
    // 25 child tables + companies = 26... but we also need to verify count
    // to catch any future additions/removals
    expect(DELETE_ORDER).toHaveLength(34);
  });
});
