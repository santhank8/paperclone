import { and, desc, eq, gte, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { heartbeatRuns } from "@paperclipai/db";

export interface TokenDeltaSummary {
  agentId: string;
  totalRuns: number;
  totalNormalizedInputTokens: number;
  totalPromptChars: number;
  sessionReusedCount: number;
  sessionReusedRate: number;
  taskSessionReusedCount: number;
  avgNormalizedInputTokens: number;
  avgPromptChars: number;
  uniqueSkillSetHashes: string[];
}

export interface TokenDeltaEntry {
  runId: string;
  agentId: string;
  startedAt: string | null;
  finishedAt: string | null;
  normalizedInputTokens: number | null;
  promptChars: number;
  sessionReused: boolean;
  taskSessionReused: boolean;
  skillSetHash: string | null;
  contextFetchMode: string | null;
  sessionIdBefore: string | null;
  sessionIdAfter: string | null;
}

export function tokenAnalyticsService(db: Db) {
  /**
   * Get token delta summary for an agent over recent runs.
   */
  async function getAgentTokenSummary(
    agentId: string,
    companyId: string,
    opts?: { sinceHours?: number; limit?: number },
  ): Promise<TokenDeltaSummary> {
    const sinceHours = opts?.sinceHours ?? 24;
    const limit = opts?.limit ?? 200;
    const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);

    const runs = await db
      .select({
        normalizedInputTokens: heartbeatRuns.normalizedInputTokens,
        promptChars: heartbeatRuns.promptChars,
        sessionReused: heartbeatRuns.sessionReused,
        taskSessionReused: heartbeatRuns.taskSessionReused,
        skillSetHash: heartbeatRuns.skillSetHash,
      })
      .from(heartbeatRuns)
      .where(
        and(
          eq(heartbeatRuns.agentId, agentId),
          eq(heartbeatRuns.companyId, companyId),
          gte(heartbeatRuns.startedAt, since),
        ),
      )
      .orderBy(desc(heartbeatRuns.startedAt))
      .limit(limit);

    const totalRuns = runs.length;
    const totalNormalizedInputTokens = runs.reduce(
      (sum, r) => sum + (r.normalizedInputTokens ?? 0),
      0,
    );
    const totalPromptChars = runs.reduce((sum, r) => sum + (r.promptChars ?? 0), 0);
    const sessionReusedCount = runs.filter((r) => r.sessionReused).length;
    const taskSessionReusedCount = runs.filter((r) => r.taskSessionReused).length;
    const skillHashes = new Set(
      runs.map((r) => r.skillSetHash).filter((h): h is string => h != null),
    );

    return {
      agentId,
      totalRuns,
      totalNormalizedInputTokens,
      totalPromptChars,
      sessionReusedCount,
      sessionReusedRate: totalRuns > 0 ? sessionReusedCount / totalRuns : 0,
      taskSessionReusedCount,
      avgNormalizedInputTokens: totalRuns > 0 ? Math.round(totalNormalizedInputTokens / totalRuns) : 0,
      avgPromptChars: totalRuns > 0 ? Math.round(totalPromptChars / totalRuns) : 0,
      uniqueSkillSetHashes: [...skillHashes],
    };
  }

  /**
   * Get per-run token delta entries for an agent.
   */
  async function getAgentTokenDeltas(
    agentId: string,
    companyId: string,
    opts?: { limit?: number; offset?: number },
  ): Promise<TokenDeltaEntry[]> {
    const limit = opts?.limit ?? 50;
    const offset = opts?.offset ?? 0;

    const runs = await db
      .select({
        id: heartbeatRuns.id,
        agentId: heartbeatRuns.agentId,
        startedAt: heartbeatRuns.startedAt,
        finishedAt: heartbeatRuns.finishedAt,
        normalizedInputTokens: heartbeatRuns.normalizedInputTokens,
        promptChars: heartbeatRuns.promptChars,
        sessionReused: heartbeatRuns.sessionReused,
        taskSessionReused: heartbeatRuns.taskSessionReused,
        skillSetHash: heartbeatRuns.skillSetHash,
        contextFetchMode: heartbeatRuns.contextFetchMode,
        sessionIdBefore: heartbeatRuns.sessionIdBefore,
        sessionIdAfter: heartbeatRuns.sessionIdAfter,
      })
      .from(heartbeatRuns)
      .where(
        and(
          eq(heartbeatRuns.agentId, agentId),
          eq(heartbeatRuns.companyId, companyId),
        ),
      )
      .orderBy(desc(heartbeatRuns.startedAt))
      .limit(limit)
      .offset(offset);

    return runs.map((r) => ({
      runId: r.id,
      agentId: r.agentId,
      startedAt: r.startedAt?.toISOString() ?? null,
      finishedAt: r.finishedAt?.toISOString() ?? null,
      normalizedInputTokens: r.normalizedInputTokens,
      promptChars: r.promptChars ?? 0,
      sessionReused: r.sessionReused ?? false,
      taskSessionReused: r.taskSessionReused ?? false,
      skillSetHash: r.skillSetHash,
      contextFetchMode: r.contextFetchMode,
      sessionIdBefore: r.sessionIdBefore,
      sessionIdAfter: r.sessionIdAfter,
    }));
  }

  /**
   * Get company-wide token usage summary.
   */
  async function getCompanyTokenSummary(
    companyId: string,
    opts?: { sinceHours?: number },
  ): Promise<{
    companyId: string;
    totalRuns: number;
    totalNormalizedInputTokens: number;
    sessionReusedRate: number;
    byAgent: Array<{ agentId: string; totalRuns: number; totalNormalizedInputTokens: number }>;
  }> {
    const sinceHours = opts?.sinceHours ?? 24;
    const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000);

    const rows = await db
      .select({
        agentId: heartbeatRuns.agentId,
        totalRuns: sql<number>`count(*)::int`,
        totalNormalizedInputTokens: sql<number>`coalesce(sum(${heartbeatRuns.normalizedInputTokens}), 0)::int`,
        sessionReusedCount: sql<number>`count(*) filter (where ${heartbeatRuns.sessionReused} = true)::int`,
      })
      .from(heartbeatRuns)
      .where(
        and(
          eq(heartbeatRuns.companyId, companyId),
          gte(heartbeatRuns.startedAt, since),
        ),
      )
      .groupBy(heartbeatRuns.agentId);

    const totalRuns = rows.reduce((s, r) => s + r.totalRuns, 0);
    const totalNormalizedInputTokens = rows.reduce((s, r) => s + r.totalNormalizedInputTokens, 0);
    const totalReused = rows.reduce((s, r) => s + r.sessionReusedCount, 0);

    return {
      companyId,
      totalRuns,
      totalNormalizedInputTokens,
      sessionReusedRate: totalRuns > 0 ? totalReused / totalRuns : 0,
      byAgent: rows.map((r) => ({
        agentId: r.agentId,
        totalRuns: r.totalRuns,
        totalNormalizedInputTokens: r.totalNormalizedInputTokens,
      })),
    };
  }

  return {
    getAgentTokenSummary,
    getAgentTokenDeltas,
    getCompanyTokenSummary,
  };
}
