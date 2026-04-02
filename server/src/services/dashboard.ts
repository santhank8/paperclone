import { and, desc, eq, gte, inArray, isNull, lt, or, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agents, approvals, companies, costEvents, heartbeatRuns, issues } from "@paperclipai/db";
import { notFound } from "../errors.js";
import { budgetService } from "./budgets.js";

export function dashboardService(db: Db) {
  const budgets = budgetService(db);
  return {
    summary: async (companyId: string) => {
      const company = await db
        .select()
        .from(companies)
        .where(eq(companies.id, companyId))
        .then((rows) => rows[0] ?? null);

      if (!company) throw notFound("Company not found");

      const agentRows = await db
        .select({ status: agents.status, count: sql<number>`count(*)` })
        .from(agents)
        .where(eq(agents.companyId, companyId))
        .groupBy(agents.status);

      const taskRows = await db
        .select({ status: issues.status, count: sql<number>`count(*)` })
        .from(issues)
        .where(eq(issues.companyId, companyId))
        .groupBy(issues.status);

      const pendingApprovals = await db
        .select({ count: sql<number>`count(*)` })
        .from(approvals)
        .where(and(eq(approvals.companyId, companyId), eq(approvals.status, "pending")))
        .then((rows) => Number(rows[0]?.count ?? 0));

      const agentCounts: Record<string, number> = {
        active: 0,
        running: 0,
        paused: 0,
        error: 0,
      };
      for (const row of agentRows) {
        const count = Number(row.count);
        // "idle" agents are operational — count them as active.
        // "error" agents are NOT counted as active; they appear in the error bucket.
        const bucket = row.status === "idle" ? "active" : row.status;
        agentCounts[bucket] = (agentCounts[bucket] ?? 0) + count;
      }

      // Stale running agents: status="running" but either no active/queued run exists,
      // or the agent hasn't completed a heartbeat in the last 30 minutes (hung process).
      const staleRunningThreshold = new Date(Date.now() - 30 * 60 * 1000);
      const staleRunningAgentRows = await db
        .select({ agentId: agents.id, lastHeartbeatAt: agents.lastHeartbeatAt })
        .from(agents)
        .where(and(eq(agents.companyId, companyId), eq(agents.status, "running")));

      let staleRunningAgents = 0;
      for (const { agentId, lastHeartbeatAt } of staleRunningAgentRows) {
        // Stale if no recent heartbeat — catches live-but-hung processes
        const heartbeatIsStale = !lastHeartbeatAt || new Date(lastHeartbeatAt) < staleRunningThreshold;
        if (heartbeatIsStale) {
          staleRunningAgents += 1;
          continue;
        }
        // Also stale if there are no active runs at all
        const [{ activeCount }] = await db
          .select({ activeCount: sql<number>`count(*)` })
          .from(heartbeatRuns)
          .where(and(eq(heartbeatRuns.agentId, agentId), inArray(heartbeatRuns.status, ["running", "queued"])));
        if (Number(activeCount) === 0) staleRunningAgents += 1;
      }

      const taskCounts: Record<string, number> = {
        open: 0,
        inProgress: 0,
        blocked: 0,
        done: 0,
      };
      for (const row of taskRows) {
        const count = Number(row.count);
        if (row.status === "in_progress") taskCounts.inProgress += count;
        if (row.status === "blocked") taskCounts.blocked += count;
        if (row.status === "done") taskCounts.done += count;
        if (row.status !== "done" && row.status !== "cancelled") taskCounts.open += count;
      }

      // Ghost tasks: in_progress with no checkout run for >1 hour
      const ghostTaskCutoff = new Date(Date.now() - 60 * 60 * 1000);
      const [{ ghostTasks }] = await db
        .select({ ghostTasks: sql<number>`count(*)` })
        .from(issues)
        .where(
          and(
            eq(issues.companyId, companyId),
            eq(issues.status, "in_progress"),
            isNull(issues.checkoutRunId),
            lt(issues.updatedAt, ghostTaskCutoff),
          ),
        );

      // Agents with 3+ consecutive silent successes: fetch recent succeeded runs per agent
      // and count leading streak of silentSuccess=true
      const SILENT_THRESHOLD = 3;
      const agentIdsInCompany = await db
        .select({ id: agents.id })
        .from(agents)
        .where(eq(agents.companyId, companyId))
        .then((rows) => rows.map((r) => r.id));

      let agentsWithSilentWarning = 0;
      const agentSilentCounts: Record<string, number> = {};

      if (agentIdsInCompany.length > 0) {
        // For each agent, fetch last N=10 succeeded runs ordered by most recent first
        const recentSucceeded = await db
          .select({
            agentId: heartbeatRuns.agentId,
            silentSuccess: heartbeatRuns.silentSuccess,
            finishedAt: heartbeatRuns.finishedAt,
          })
          .from(heartbeatRuns)
          .where(
            and(
              eq(heartbeatRuns.companyId, companyId),
              inArray(heartbeatRuns.agentId, agentIdsInCompany),
              eq(heartbeatRuns.status, "succeeded"),
            ),
          )
          .orderBy(desc(heartbeatRuns.finishedAt))
          .limit(agentIdsInCompany.length * 10);

        // Group by agent and count consecutive leading silent successes
        const byAgent: Record<string, boolean[]> = {};
        for (const row of recentSucceeded) {
          if (!byAgent[row.agentId]) byAgent[row.agentId] = [];
          if (byAgent[row.agentId].length < 10) byAgent[row.agentId].push(row.silentSuccess);
        }

        for (const [agentId, flags] of Object.entries(byAgent)) {
          let streak = 0;
          for (const isSilent of flags) {
            if (isSilent) streak++;
            else break;
          }
          agentSilentCounts[agentId] = streak;
          if (streak >= SILENT_THRESHOLD) agentsWithSilentWarning++;
        }
      }

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const [{ monthSpend }] = await db
        .select({
          monthSpend: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
        })
        .from(costEvents)
        .where(
          and(
            eq(costEvents.companyId, companyId),
            gte(costEvents.occurredAt, monthStart),
          ),
        );

      const monthSpendCents = Number(monthSpend);
      const utilization =
        company.budgetMonthlyCents > 0
          ? (monthSpendCents / company.budgetMonthlyCents) * 100
          : 0;
      const budgetOverview = await budgets.overview(companyId);

      return {
        companyId,
        agents: {
          active: agentCounts.active,
          running: agentCounts.running,
          paused: agentCounts.paused,
          error: agentCounts.error,
          staleRunning: staleRunningAgents,
          silentWarning: agentsWithSilentWarning,
          silentCounts: agentSilentCounts,
        },
        tasks: {
          ...taskCounts,
          ghostTasks: Number(ghostTasks),
        },
        costs: {
          monthSpendCents,
          monthBudgetCents: company.budgetMonthlyCents,
          monthUtilizationPercent: Number(utilization.toFixed(2)),
        },
        pendingApprovals,
        budgets: {
          activeIncidents: budgetOverview.activeIncidents.length,
          pendingApprovals: budgetOverview.pendingApprovalCount,
          pausedAgents: budgetOverview.pausedAgentCount,
          pausedProjects: budgetOverview.pausedProjectCount,
        },
      };
    },
  };
}
