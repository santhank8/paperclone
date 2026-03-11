import { and, eq, gte, inArray, isNotNull, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agents, approvals, companies, costEvents, heartbeatRuns, issues } from "@paperclipai/db";
import { notFound } from "../errors.js";
import { loadHeartbeatRunStderrStats } from "./heartbeat-run-stderr.js";

const effectiveCostCentsExpr = sql<number>`case
  when ${costEvents.billingType} = 'api'
    and ${costEvents.costCents} = 0
    and ${costEvents.calculatedCostCents} is not null
  then ${costEvents.calculatedCostCents}
  else ${costEvents.costCents}
end`;

export function dashboardService(db: Db) {
  return {
    summary: async (companyId: string) => {
      const company = await db
        .select()
        .from(companies)
        .where(eq(companies.id, companyId))
        .then((rows) => rows[0] ?? null);

      if (!company) throw notFound("Company not found");

      const agentRows = await db
        .select({ id: agents.id, status: agents.status })
        .from(agents)
        .where(eq(agents.companyId, companyId));

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

      const staleCutoff = new Date(Date.now() - 60 * 60 * 1000);
      const staleTasks = await db
        .select({ count: sql<number>`count(*)` })
        .from(issues)
        .where(
          and(
            eq(issues.companyId, companyId),
            eq(issues.status, "in_progress"),
            sql`${issues.startedAt} < ${staleCutoff.toISOString()}`,
          ),
        )
        .then((rows) => Number(rows[0]?.count ?? 0));

      const actionableAgentIds = new Set(
        await db
          .selectDistinct({ assigneeAgentId: issues.assigneeAgentId })
          .from(issues)
          .where(
            and(
              eq(issues.companyId, companyId),
              inArray(issues.status, ["todo", "in_progress"]),
              isNotNull(issues.assigneeAgentId),
            ),
          )
          .then((rows) =>
            rows
              .map((row) => row.assigneeAgentId)
              .filter((value): value is string => typeof value === "string" && value.length > 0),
          ),
      );

      const agentCounts: Record<string, number> = {
        actionable: 0,
        running: 0,
        paused: 0,
        error: 0,
        idleWithoutActionable: 0,
      };
      for (const row of agentRows) {
        if (row.status === "paused") {
          agentCounts.paused += 1;
          continue;
        }
        if (row.status === "error") {
          agentCounts.error += 1;
          continue;
        }
        if (row.status === "running") {
          agentCounts.running += 1;
        }
        if (actionableAgentIds.has(row.id)) {
          agentCounts.actionable += 1;
        } else if (row.status === "idle" || row.status === "active" || row.status === "running") {
          agentCounts.idleWithoutActionable += 1;
        }
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

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const [{ monthSpend }] = await db
        .select({
          monthSpend: sql<number>`coalesce(sum(${effectiveCostCentsExpr}), 0)::int`,
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

      // Phase 6: runtime health — last 7 days, this company only
      const healthSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const runRows = await db
        .select({
          id: heartbeatRuns.id,
          invocationSource: heartbeatRuns.invocationSource,
          status: heartbeatRuns.status,
          stderrExcerpt: heartbeatRuns.stderrExcerpt,
          sessionIdBefore: heartbeatRuns.sessionIdBefore,
          inputTokens: sql<number>`COALESCE(
            (${heartbeatRuns.usageJson}->>'input_tokens')::int,
            (${heartbeatRuns.usageJson}->>'prompt_tokens')::int,
            0
          )`,
        })
        .from(heartbeatRuns)
        .where(
          and(
            eq(heartbeatRuns.companyId, companyId),
            gte(heartbeatRuns.createdAt, healthSince),
            isNotNull(heartbeatRuns.finishedAt),
          ),
        );

      const healthTotal = runRows.length;
      let runtimeHealth: { windowDays: number; totalRuns: number; timerWakeSkipPct: number | null; stderrNoisePct: number | null; sessionResumeRatePct: number | null; medianTimerInputTokens: number | null } | undefined;

      if (healthTotal > 0) {
        const stderrStatsByRunId = await loadHeartbeatRunStderrStats(db, runRows.map((r) => r.id));
        const timerRows = runRows.filter((r) => r.invocationSource === "timer");
        const skippedRows = runRows.filter((r) => r.status === "skipped");
        const succeededWithStderr = runRows.filter(
          (r) => {
            if (r.status !== "succeeded") return false;
            const stats = stderrStatsByRunId.get(r.id);
            if (stats) return stats.errorCount > 0;
            return Boolean(r.stderrExcerpt && r.stderrExcerpt.trim().length > 0);
          },
        );
        const withSession = runRows.filter((r) => r.sessionIdBefore != null);

        const medianOf = (nums: number[]): number | null => {
          if (nums.length === 0) return null;
          const sorted = [...nums].sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          return sorted.length % 2 !== 0
            ? (sorted[mid] ?? null)
            : Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2);
        };
        const timerTokens = timerRows.map((r) => Number(r.inputTokens ?? 0));

        runtimeHealth = {
          windowDays: 7,
          totalRuns: healthTotal,
          timerWakeSkipPct: timerRows.length > 0
            ? Math.round((skippedRows.length / timerRows.length) * 100)
            : null,
          stderrNoisePct: Math.round((succeededWithStderr.length / healthTotal) * 100),
          sessionResumeRatePct: Math.round((withSession.length / healthTotal) * 100),
          medianTimerInputTokens: medianOf(timerTokens),
        };
      }

      return {
        companyId,
        agents: {
          actionable: agentCounts.actionable,
          running: agentCounts.running,
          paused: agentCounts.paused,
          error: agentCounts.error,
          idleWithoutActionable: agentCounts.idleWithoutActionable,
        },
        tasks: taskCounts,
        costs: {
          monthSpendCents,
          monthBudgetCents: company.budgetMonthlyCents,
          monthUtilizationPercent: Number(utilization.toFixed(2)),
        },
        pendingApprovals,
        staleTasks,
        runtimeHealth,
      };
    },
  };
}
