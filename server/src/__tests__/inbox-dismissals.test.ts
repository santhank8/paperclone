import { describe, expect, it } from "vitest";
import {
  buildAgentErrorsFingerprint,
  buildBudgetAlertFingerprint,
  deriveActiveInboxDismissals,
} from "../services/inbox-dismissals.ts";

describe("inbox dismissal helpers", () => {
  it("treats failed run dismissals as active only for current failed run ids", () => {
    const active = deriveActiveInboxDismissals(
      [
        {
          id: "d1",
          companyId: "c1",
          userId: "u1",
          kind: "failed_run",
          targetId: "run-1",
          fingerprint: "run-1",
          createdAt: new Date("2026-03-10T10:00:00.000Z"),
          updatedAt: new Date("2026-03-10T10:00:00.000Z"),
        },
      ],
      {
        failedRunIds: new Set(["run-1", "run-2"]),
        staleIssueFingerprints: new Map(),
        agentErrorsFingerprint: null,
        showAgentErrorsAlert: false,
        budgetFingerprint: null,
        showBudgetAlert: false,
      },
    );

    expect(active.failedRunIds).toEqual(["run-1"]);
  });

  it("drops stale issue dismissals when the issue fingerprint changes", () => {
    const active = deriveActiveInboxDismissals(
      [
        {
          id: "d1",
          companyId: "c1",
          userId: "u1",
          kind: "stale_issue",
          targetId: "issue-1",
          fingerprint: "2026-03-10T10:00:00.000Z",
          createdAt: new Date("2026-03-10T10:00:00.000Z"),
          updatedAt: new Date("2026-03-10T10:00:00.000Z"),
        },
      ],
      {
        failedRunIds: new Set(),
        staleIssueFingerprints: new Map([["issue-1", "2026-03-10T11:00:00.000Z"]]),
        agentErrorsFingerprint: null,
        showAgentErrorsAlert: false,
        budgetFingerprint: null,
        showBudgetAlert: false,
      },
    );

    expect(active.staleIssueIds).toEqual([]);
  });

  it("activates singleton alerts only when fingerprints still match", () => {
    const active = deriveActiveInboxDismissals(
      [
        {
          id: "d1",
          companyId: "c1",
          userId: "u1",
          kind: "agent_errors_alert",
          targetId: "__agent_errors__",
          fingerprint: "agent-a,agent-b",
          createdAt: new Date("2026-03-10T10:00:00.000Z"),
          updatedAt: new Date("2026-03-10T10:00:00.000Z"),
        },
        {
          id: "d2",
          companyId: "c1",
          userId: "u1",
          kind: "budget_alert",
          targetId: "__budget__",
          fingerprint: "2026-03:10000",
          createdAt: new Date("2026-03-10T10:00:00.000Z"),
          updatedAt: new Date("2026-03-10T10:00:00.000Z"),
        },
      ],
      {
        failedRunIds: new Set(),
        staleIssueFingerprints: new Map(),
        agentErrorsFingerprint: "agent-a,agent-b",
        showAgentErrorsAlert: true,
        budgetFingerprint: "2026-03:10000",
        showBudgetAlert: true,
      },
    );

    expect(active.alerts).toEqual({ agentErrors: true, budget: true });
  });

  it("builds deterministic fingerprints for alerts", () => {
    expect(buildAgentErrorsFingerprint(["agent-b", "agent-a"])).toBe("agent-a,agent-b");
    expect(buildBudgetAlertFingerprint(new Date("2026-03-11T05:00:00.000Z"), 12500)).toBe("2026-03:12500");
  });
});
