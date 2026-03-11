import { and, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agents, companies, costEvents, inboxDismissals, issues } from "@paperclipai/db";
import type { CreateInboxDismissalRequest, InboxDismissalsResponse } from "@paperclipai/shared";
import { notFound } from "../errors.js";
import { heartbeatService } from "./heartbeat.js";

const STALE_MINUTES = 24 * 60;
const AGENT_ERRORS_TARGET_ID = "__agent_errors__";
const BUDGET_TARGET_ID = "__budget__";

const effectiveCostCentsExpr = sql<number>`case
  when ${costEvents.billingType} = 'api'
    and ${costEvents.costCents} = 0
    and ${costEvents.calculatedCostCents} is not null
  then ${costEvents.calculatedCostCents}
  else ${costEvents.costCents}
end`;

type InboxDismissalRow = typeof inboxDismissals.$inferSelect;

interface CurrentDismissalState {
  failedRunIds: Set<string>;
  staleIssueFingerprints: Map<string, string>;
  agentErrorsFingerprint: string | null;
  showAgentErrorsAlert: boolean;
  budgetFingerprint: string | null;
  showBudgetAlert: boolean;
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function buildBudgetAlertFingerprint(date: Date, monthBudgetCents: number) {
  return `${monthKey(date)}:${monthBudgetCents}`;
}

export function buildAgentErrorsFingerprint(agentIds: string[]) {
  return [...agentIds].sort().join(",");
}

function staleIssueFingerprint(updatedAt: Date | string) {
  return new Date(updatedAt).toISOString();
}

function emptyDismissals(): InboxDismissalsResponse {
  return {
    failedRunIds: [],
    staleIssueIds: [],
    alerts: {
      agentErrors: false,
      budget: false,
    },
    items: [],
  };
}

export function deriveActiveInboxDismissals(
  rows: InboxDismissalRow[],
  current: CurrentDismissalState,
): InboxDismissalsResponse {
  const active = emptyDismissals();

  for (const row of rows) {
    switch (row.kind) {
      case "failed_run":
        if (current.failedRunIds.has(row.targetId) && row.fingerprint === row.targetId) {
          active.failedRunIds.push(row.targetId);
          active.items.push({
            kind: "failed_run",
            targetId: row.targetId,
            fingerprint: row.fingerprint,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          });
        }
        break;
      case "stale_issue": {
        const fingerprint = current.staleIssueFingerprints.get(row.targetId);
        if (fingerprint && fingerprint === row.fingerprint) {
          active.staleIssueIds.push(row.targetId);
          active.items.push({
            kind: "stale_issue",
            targetId: row.targetId,
            fingerprint: row.fingerprint,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          });
        }
        break;
      }
      case "agent_errors_alert":
        if (
          current.showAgentErrorsAlert &&
          current.agentErrorsFingerprint &&
          row.targetId === AGENT_ERRORS_TARGET_ID &&
          row.fingerprint === current.agentErrorsFingerprint
        ) {
          active.alerts.agentErrors = true;
          active.items.push({
            kind: "agent_errors_alert",
            targetId: row.targetId,
            fingerprint: row.fingerprint,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          });
        }
        break;
      case "budget_alert":
        if (
          current.showBudgetAlert &&
          current.budgetFingerprint &&
          row.targetId === BUDGET_TARGET_ID &&
          row.fingerprint === current.budgetFingerprint
        ) {
          active.alerts.budget = true;
          active.items.push({
            kind: "budget_alert",
            targetId: row.targetId,
            fingerprint: row.fingerprint,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
          });
        }
        break;
    }
  }

  return active;
}

export function inboxDismissalService(db: Db) {
  const heartbeat = heartbeatService(db);

  async function loadCurrentState(companyId: string): Promise<CurrentDismissalState> {
    const cutoff = new Date(Date.now() - STALE_MINUTES * 60 * 1000);
    const now = new Date();

    const [failedRuns, staleIssues, erroredAgentRows, company] = await Promise.all([
      heartbeat.listLatestFailedRuns(companyId),
      db
        .select({ id: issues.id, updatedAt: issues.updatedAt })
        .from(issues)
        .where(
          and(
            eq(issues.companyId, companyId),
            inArray(issues.status, ["in_progress", "todo"]),
            isNull(issues.hiddenAt),
            sql`${issues.updatedAt} < ${cutoff.toISOString()}`,
          ),
        ),
      db
        .select({ id: agents.id })
        .from(agents)
        .where(and(eq(agents.companyId, companyId), eq(agents.status, "error"))),
      db
        .select({ budgetMonthlyCents: companies.budgetMonthlyCents })
        .from(companies)
        .where(eq(companies.id, companyId))
        .then((rows) => rows[0] ?? null),
    ]);

    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const [{ monthSpend }] = company
      ? await db
        .select({
          monthSpend: sql<number>`coalesce(sum(${effectiveCostCentsExpr}), 0)::int`,
        })
        .from(costEvents)
        .where(and(eq(costEvents.companyId, companyId), gte(costEvents.occurredAt, monthStart)))
      : [{ monthSpend: 0 }];

    const budgetMonthlyCents = Number(company?.budgetMonthlyCents ?? 0);
    const monthSpendCents = Number(monthSpend ?? 0);
    const showBudgetAlert =
      budgetMonthlyCents > 0 && (monthSpendCents / budgetMonthlyCents) * 100 >= 80;

    const erroredAgentIds = erroredAgentRows.map((row) => row.id);

    return {
      failedRunIds: new Set(failedRuns.map((run) => run.id)),
      staleIssueFingerprints: new Map(
        staleIssues.map((issue) => [issue.id, staleIssueFingerprint(issue.updatedAt)]),
      ),
      agentErrorsFingerprint:
        erroredAgentIds.length > 0 ? buildAgentErrorsFingerprint(erroredAgentIds) : null,
      showAgentErrorsAlert: erroredAgentIds.length > 0 && failedRuns.length === 0,
      budgetFingerprint: showBudgetAlert ? buildBudgetAlertFingerprint(now, budgetMonthlyCents) : null,
      showBudgetAlert,
    };
  }

  async function listRows(companyId: string, userId: string) {
    return db
      .select()
      .from(inboxDismissals)
      .where(and(eq(inboxDismissals.companyId, companyId), eq(inboxDismissals.userId, userId)));
  }

  return {
    listActive: async (companyId: string, userId: string) => {
      const [rows, current] = await Promise.all([listRows(companyId, userId), loadCurrentState(companyId)]);
      return deriveActiveInboxDismissals(rows, current);
    },

    dismiss: async (companyId: string, userId: string, input: CreateInboxDismissalRequest) => {
      const current = await loadCurrentState(companyId);
      let targetId: string;
      let fingerprint: string;

      switch (input.kind) {
        case "failed_run":
          if (!current.failedRunIds.has(input.runId)) throw notFound("Failed run inbox item not found");
          targetId = input.runId;
          fingerprint = input.runId;
          break;
        case "stale_issue": {
          const staleFingerprint = current.staleIssueFingerprints.get(input.issueId);
          if (!staleFingerprint) throw notFound("Stale issue inbox item not found");
          targetId = input.issueId;
          fingerprint = staleFingerprint;
          break;
        }
        case "agent_errors_alert":
          if (!current.showAgentErrorsAlert || !current.agentErrorsFingerprint) {
            throw notFound("Agent error alert not found");
          }
          targetId = AGENT_ERRORS_TARGET_ID;
          fingerprint = current.agentErrorsFingerprint;
          break;
        case "budget_alert":
          if (!current.showBudgetAlert || !current.budgetFingerprint) {
            throw notFound("Budget alert not found");
          }
          targetId = BUDGET_TARGET_ID;
          fingerprint = current.budgetFingerprint;
          break;
      }

      const now = new Date();
      const [row] = await db
        .insert(inboxDismissals)
        .values({
          companyId,
          userId,
          kind: input.kind,
          targetId,
          fingerprint,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [
            inboxDismissals.companyId,
            inboxDismissals.userId,
            inboxDismissals.kind,
            inboxDismissals.targetId,
          ],
          set: {
            fingerprint,
            updatedAt: now,
          },
        })
        .returning();

      return row;
    },

    clear: async (companyId: string, userId: string) => {
      const rows = await db
        .delete(inboxDismissals)
        .where(and(eq(inboxDismissals.companyId, companyId), eq(inboxDismissals.userId, userId)))
        .returning();
      return rows.length;
    },
  };
}
