import { and, desc, eq, gte, isNotNull, lte, ne, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agents, companies, costEvents, heartbeatRuns, issues, projects } from "@paperclipai/db";
import type { CostByProvider, CostWindow } from "@paperclipai/shared";
import { notFound, unprocessable } from "../errors.js";

export interface CostDateRange {
  from?: Date;
  to?: Date;
}

function effectiveCostCentsExpr() {
  return sql<number>`case
    when ${costEvents.billingType} = 'api'
      and ${costEvents.costCents} = 0
      and ${costEvents.calculatedCostCents} is not null
    then ${costEvents.calculatedCostCents}
    else ${costEvents.costCents}
  end`;
}

function effectiveCostCentsValue(data: Pick<typeof costEvents.$inferInsert, "billingType" | "costCents" | "calculatedCostCents">) {
  if (data.billingType === "api" && data.costCents === 0 && data.calculatedCostCents != null) {
    return data.calculatedCostCents;
  }
  return data.costCents;
}

function buildCostConditions(companyId: string, range?: CostDateRange) {
  const conditions: ReturnType<typeof eq>[] = [eq(costEvents.companyId, companyId)];
  if (range?.from) conditions.push(gte(costEvents.occurredAt, range.from));
  if (range?.to) conditions.push(lte(costEvents.occurredAt, range.to));
  return conditions;
}

function normalizeBillingType(value: string | null | undefined): "api" | "subscription" | "unknown" {
  if (value === "api" || value === "subscription") return value;
  return "unknown";
}

function normalizeProvider(value: string | null | undefined): string {
  return value?.trim() ? value.trim() : "unknown";
}

function readContextString(
  snapshot: Record<string, unknown> | null | undefined,
  key: string,
): string | null {
  if (!snapshot) return null;
  const value = snapshot[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function costService(db: Db) {
  return {
    createEvent: async (companyId: string, data: Omit<typeof costEvents.$inferInsert, "companyId">) => {
      const agent = await db
        .select()
        .from(agents)
        .where(eq(agents.id, data.agentId))
        .then((rows) => rows[0] ?? null);

      if (!agent) throw notFound("Agent not found");
      if (agent.companyId !== companyId) {
        throw unprocessable("Agent does not belong to company");
      }

      let run: typeof heartbeatRuns.$inferSelect | null = null;
      if (data.runId) {
        run = await db
          .select()
          .from(heartbeatRuns)
          .where(eq(heartbeatRuns.id, data.runId))
          .then((rows) => rows[0] ?? null);

        if (!run) throw notFound("Heartbeat run not found");
        if (run.companyId !== companyId) {
          throw unprocessable("Heartbeat run does not belong to company");
        }
        if (run.agentId !== data.agentId) {
          throw unprocessable("Heartbeat run does not belong to agent");
        }
      }

      let resolvedIssueId = data.issueId ?? null;
      let resolvedProjectId = data.projectId ?? null;
      let resolvedGoalId = data.goalId ?? null;
      let resolvedBillingCode = data.billingCode ?? null;

      const runContext =
        run?.contextSnapshot && typeof run.contextSnapshot === "object" && !Array.isArray(run.contextSnapshot)
          ? (run.contextSnapshot as Record<string, unknown>)
          : null;

      if (!resolvedIssueId) {
        const contextIssueId = readContextString(runContext, "issueId") ?? readContextString(runContext, "taskId");
        if (contextIssueId) resolvedIssueId = contextIssueId;
      }

      if (!resolvedProjectId) {
        const contextProjectId = readContextString(runContext, "projectId");
        if (contextProjectId) resolvedProjectId = contextProjectId;
      }

      if (resolvedIssueId || resolvedProjectId == null || resolvedGoalId == null || resolvedBillingCode == null) {
        const issue =
          resolvedIssueId
            ? await db
                .select()
                .from(issues)
                .where(eq(issues.id, resolvedIssueId))
                .then((rows) => rows[0] ?? null)
            : null;

        if (issue) {
          if (issue.companyId !== companyId) {
            throw unprocessable("Issue does not belong to company");
          }
          resolvedIssueId = issue.id;
          resolvedProjectId ??= issue.projectId ?? null;
          resolvedGoalId ??= issue.goalId ?? null;
          resolvedBillingCode ??= issue.billingCode ?? null;
        }
      }

      if (!resolvedProjectId) {
        const singleProjectRows = await db
          .select({ projectId: issues.projectId })
          .from(issues)
          .where(
            and(
              eq(issues.companyId, companyId),
              eq(issues.assigneeAgentId, data.agentId),
              isNotNull(issues.projectId),
              ne(issues.status, "cancelled"),
            ),
          )
          .groupBy(issues.projectId);
        const distinctProjectIds = singleProjectRows
          .map((row) => row.projectId)
          .filter((projectId): projectId is string => Boolean(projectId));
        if (distinctProjectIds.length === 1) {
          resolvedProjectId = distinctProjectIds[0] ?? null;
        }
      }

      const eventInsert = {
        ...data,
        companyId,
        issueId: resolvedIssueId,
        projectId: resolvedProjectId,
        goalId: resolvedGoalId,
        billingCode: resolvedBillingCode,
        adapterType: data.adapterType ?? agent.adapterType ?? "unknown",
        billingType: data.billingType ?? "unknown",
      } satisfies typeof costEvents.$inferInsert;

      const event = await db
        .insert(costEvents)
        .values(eventInsert)
        .returning()
        .then((rows) => rows[0]);

      const effectiveCostCents = effectiveCostCentsValue(event);

      await db
        .update(agents)
        .set({
          spentMonthlyCents: sql`${agents.spentMonthlyCents} + ${effectiveCostCents}`,
          updatedAt: new Date(),
        })
        .where(eq(agents.id, event.agentId));

      await db
        .update(companies)
        .set({
          spentMonthlyCents: sql`${companies.spentMonthlyCents} + ${effectiveCostCents}`,
          updatedAt: new Date(),
        })
        .where(eq(companies.id, companyId));

      const updatedAgent = await db
        .select()
        .from(agents)
        .where(eq(agents.id, event.agentId))
        .then((rows) => rows[0] ?? null);

      if (
        updatedAgent &&
        updatedAgent.budgetMonthlyCents > 0 &&
        updatedAgent.spentMonthlyCents >= updatedAgent.budgetMonthlyCents &&
        updatedAgent.status !== "paused" &&
        updatedAgent.status !== "terminated"
      ) {
        await db
          .update(agents)
          .set({ status: "paused", updatedAt: new Date() })
          .where(eq(agents.id, updatedAgent.id));
      }

      return event;
    },

    summary: async (companyId: string, range?: CostDateRange) => {
      const company = await db
        .select()
        .from(companies)
        .where(eq(companies.id, companyId))
        .then((rows) => rows[0] ?? null);

      if (!company) throw notFound("Company not found");

      const conditions = buildCostConditions(companyId, range);

      const [{ total }] = await db
        .select({
          total: sql<number>`coalesce(sum(${effectiveCostCentsExpr()}), 0)::int`,
        })
        .from(costEvents)
        .where(and(...conditions));

      const spendCents = Number(total);
      const utilization =
        company.budgetMonthlyCents > 0
          ? (spendCents / company.budgetMonthlyCents) * 100
          : 0;

      return {
        companyId,
        spendCents,
        budgetCents: company.budgetMonthlyCents,
        utilizationPercent: Number(utilization.toFixed(2)),
      };
    },

    byAgent: async (companyId: string, range?: CostDateRange) => {
      const conditions = buildCostConditions(companyId, range);

      const effectiveCost = effectiveCostCentsExpr();

      const costRows = await db
        .select({
          agentId: costEvents.agentId,
          agentName: agents.name,
          agentStatus: agents.status,
          agentAdapterType: sql<string>`coalesce(${costEvents.adapterType}, ${agents.adapterType}, 'unknown')`,
          costCents: sql<number>`coalesce(sum(${effectiveCost}), 0)::int`,
          inputTokens: sql<number>`coalesce(sum(${costEvents.inputTokens}), 0)::int`,
          outputTokens: sql<number>`coalesce(sum(${costEvents.outputTokens}), 0)::int`,
          apiRunCount:
            sql<number>`coalesce(sum(case when ${costEvents.billingType} = 'api' then 1 else 0 end), 0)::int`,
          subscriptionRunCount:
            sql<number>`coalesce(sum(case when ${costEvents.billingType} = 'subscription' then 1 else 0 end), 0)::int`,
          subscriptionInputTokens:
            sql<number>`coalesce(sum(case when ${costEvents.billingType} = 'subscription' then ${costEvents.inputTokens} else 0 end), 0)::int`,
          subscriptionOutputTokens:
            sql<number>`coalesce(sum(case when ${costEvents.billingType} = 'subscription' then ${costEvents.outputTokens} else 0 end), 0)::int`,
        })
        .from(costEvents)
        .leftJoin(agents, eq(costEvents.agentId, agents.id))
        .where(and(...conditions))
        .groupBy(costEvents.agentId, agents.name, agents.status, costEvents.adapterType, agents.adapterType)
        .orderBy(desc(sql`coalesce(sum(${effectiveCost}), 0)::int`));

      return costRows;
    },

    byRuntime: async (companyId: string, range?: CostDateRange) => {
      const conditions = buildCostConditions(companyId, range);

      const effectiveCost = effectiveCostCentsExpr();
      const apiCostCentsExpr =
        sql<number>`coalesce(sum(case when ${costEvents.billingType} = 'api' then ${effectiveCost} else 0 end), 0)::int`;
      const totalRunCountExpr = sql<number>`count(*)::int`;

      return db
        .select({
          adapterType: costEvents.adapterType,
          costCents: sql<number>`coalesce(sum(${effectiveCost}), 0)::int`,
          apiCostCents: apiCostCentsExpr,
          apiRunCount:
            sql<number>`coalesce(sum(case when ${costEvents.billingType} = 'api' then 1 else 0 end), 0)::int`,
          apiInputTokens:
            sql<number>`coalesce(sum(case when ${costEvents.billingType} = 'api' then ${costEvents.inputTokens} else 0 end), 0)::int`,
          apiOutputTokens:
            sql<number>`coalesce(sum(case when ${costEvents.billingType} = 'api' then ${costEvents.outputTokens} else 0 end), 0)::int`,
          subscriptionRunCount:
            sql<number>`coalesce(sum(case when ${costEvents.billingType} = 'subscription' then 1 else 0 end), 0)::int`,
          subscriptionInputTokens:
            sql<number>`coalesce(sum(case when ${costEvents.billingType} = 'subscription' then ${costEvents.inputTokens} else 0 end), 0)::int`,
          subscriptionOutputTokens:
            sql<number>`coalesce(sum(case when ${costEvents.billingType} = 'subscription' then ${costEvents.outputTokens} else 0 end), 0)::int`,
          unknownRunCount:
            sql<number>`coalesce(sum(case when ${costEvents.billingType} not in ('api', 'subscription') then 1 else 0 end), 0)::int`,
          unknownInputTokens:
            sql<number>`coalesce(sum(case when ${costEvents.billingType} not in ('api', 'subscription') then ${costEvents.inputTokens} else 0 end), 0)::int`,
          unknownOutputTokens:
            sql<number>`coalesce(sum(case when ${costEvents.billingType} not in ('api', 'subscription') then ${costEvents.outputTokens} else 0 end), 0)::int`,
          totalRunCount: totalRunCountExpr,
        })
        .from(costEvents)
        .where(and(...conditions))
        .groupBy(costEvents.adapterType)
        .orderBy(desc(apiCostCentsExpr), desc(totalRunCountExpr), costEvents.adapterType);
    },

    byProvider: async (companyId: string, range?: CostDateRange): Promise<CostByProvider[]> => {
      const conditions = buildCostConditions(companyId, range);
      const effectiveCost = effectiveCostCentsExpr();

      const rows = await db
        .select({
          provider: costEvents.provider,
          billingType: costEvents.billingType,
          model: costEvents.model,
          costCents: sql<number>`coalesce(sum(${effectiveCost}), 0)::int`,
          runCount: sql<number>`count(*)::int`,
          inputTokens: sql<number>`coalesce(sum(${costEvents.inputTokens}), 0)::int`,
          outputTokens: sql<number>`coalesce(sum(${costEvents.outputTokens}), 0)::int`,
        })
        .from(costEvents)
        .where(and(...conditions))
        .groupBy(costEvents.provider, costEvents.billingType, costEvents.model)
        .orderBy(
          costEvents.provider,
          costEvents.billingType,
          desc(sql`coalesce(sum(${effectiveCost}), 0)::int`),
          desc(sql`count(*)::int`),
          costEvents.model,
        );

      const grouped = new Map<string, CostByProvider>();
      for (const row of rows) {
        const provider = normalizeProvider(row.provider);
        const billingType = normalizeBillingType(row.billingType);
        const key = `${provider}:${billingType}`;
        const current = grouped.get(key) ?? {
          provider,
          billingType,
          costCents: 0,
          runCount: 0,
          inputTokens: 0,
          outputTokens: 0,
          models: [],
        };

        current.costCents += Number(row.costCents ?? 0);
        current.runCount += Number(row.runCount ?? 0);
        current.inputTokens += Number(row.inputTokens ?? 0);
        current.outputTokens += Number(row.outputTokens ?? 0);
        current.models.push({
          model: row.model ?? "unknown",
          billingType,
          costCents: Number(row.costCents ?? 0),
          runCount: Number(row.runCount ?? 0),
          inputTokens: Number(row.inputTokens ?? 0),
          outputTokens: Number(row.outputTokens ?? 0),
        });
        grouped.set(key, current);
      }

      return [...grouped.values()].sort((left, right) => {
        if (right.costCents !== left.costCents) return right.costCents - left.costCents;
        if (right.runCount !== left.runCount) return right.runCount - left.runCount;
        if (left.provider !== right.provider) return left.provider.localeCompare(right.provider);
        return left.billingType.localeCompare(right.billingType);
      });
    },

    windows: async (companyId: string): Promise<CostWindow[]> => {
      const now = new Date();
      const windows: Array<Pick<CostWindow, "key" | "label"> & { hours: number }> = [
        { key: "5h", label: "Last 5h", hours: 5 },
        { key: "24h", label: "Last 24h", hours: 24 },
        { key: "7d", label: "Last 7d", hours: 24 * 7 },
        { key: "30d", label: "Last 30d", hours: 24 * 30 },
      ];
      const effectiveCost = effectiveCostCentsExpr();

      return Promise.all(
        windows.map(async (window) => {
          const from = new Date(now.getTime() - window.hours * 60 * 60 * 1000);
          const [row] = await db
            .select({
              apiSpendCents:
                sql<number>`coalesce(sum(case when ${costEvents.billingType} = 'api' then ${effectiveCost} else 0 end), 0)::int`,
              apiRunCount:
                sql<number>`coalesce(sum(case when ${costEvents.billingType} = 'api' then 1 else 0 end), 0)::int`,
              subscriptionRunCount:
                sql<number>`coalesce(sum(case when ${costEvents.billingType} = 'subscription' then 1 else 0 end), 0)::int`,
              unknownRunCount:
                sql<number>`coalesce(sum(case when ${costEvents.billingType} not in ('api', 'subscription') then 1 else 0 end), 0)::int`,
              totalRunCount: sql<number>`count(*)::int`,
              inputTokens: sql<number>`coalesce(sum(${costEvents.inputTokens}), 0)::int`,
              outputTokens: sql<number>`coalesce(sum(${costEvents.outputTokens}), 0)::int`,
              subscriptionInputTokens:
                sql<number>`coalesce(sum(case when ${costEvents.billingType} = 'subscription' then ${costEvents.inputTokens} else 0 end), 0)::int`,
              subscriptionOutputTokens:
                sql<number>`coalesce(sum(case when ${costEvents.billingType} = 'subscription' then ${costEvents.outputTokens} else 0 end), 0)::int`,
            })
            .from(costEvents)
            .where(and(...buildCostConditions(companyId, { from, to: now })));

          return {
            key: window.key,
            label: window.label,
            from: from.toISOString(),
            to: now.toISOString(),
            apiSpendCents: Number(row?.apiSpendCents ?? 0),
            apiRunCount: Number(row?.apiRunCount ?? 0),
            subscriptionRunCount: Number(row?.subscriptionRunCount ?? 0),
            unknownRunCount: Number(row?.unknownRunCount ?? 0),
            totalRunCount: Number(row?.totalRunCount ?? 0),
            inputTokens: Number(row?.inputTokens ?? 0),
            outputTokens: Number(row?.outputTokens ?? 0),
            subscriptionInputTokens: Number(row?.subscriptionInputTokens ?? 0),
            subscriptionOutputTokens: Number(row?.subscriptionOutputTokens ?? 0),
          } satisfies CostWindow;
        }),
      );
    },

    byProject: async (companyId: string, range?: CostDateRange) => {
      const conditions = buildCostConditions(companyId, range);
      const effectiveCost = effectiveCostCentsExpr();
      return db
        .select({
          projectId: costEvents.projectId,
          projectName: projects.name,
          costCents: sql<number>`coalesce(sum(${effectiveCost}), 0)::int`,
          inputTokens: sql<number>`coalesce(sum(${costEvents.inputTokens}), 0)::int`,
          outputTokens: sql<number>`coalesce(sum(${costEvents.outputTokens}), 0)::int`,
        })
        .from(costEvents)
        .innerJoin(projects, eq(costEvents.projectId, projects.id))
        .where(and(...conditions, isNotNull(costEvents.projectId)))
        .groupBy(costEvents.projectId, projects.name)
        .orderBy(desc(sql`coalesce(sum(${effectiveCost}), 0)::int`));
    },
  };
}
