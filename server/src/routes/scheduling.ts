import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { issues, agents, projects } from "@paperclipai/db";
import { eq, and } from "drizzle-orm";
import { describeCron } from "@paperclipai/shared";
import { getNextCronOccurrence } from "@paperclipai/shared";
import type { UnifiedScheduledJob, RunHistoryEntry } from "@paperclipai/shared";
import { openclawCronService, type OpenClawCronJob } from "../services/openclaw-cron.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

function mapLastStatus(status?: string): "success" | "error" | "running" | undefined {
  if (!status) return undefined;
  const s = status.toLowerCase();
  if (s === "success" || s === "completed" || s === "updated") return "success";
  if (s === "error" || s === "failed") return "error";
  if (s === "running" || s === "pending") return "running";
  return "success";
}

function mapOpenClawJob(job: OpenClawCronJob): UnifiedScheduledJob {
  // Handle different schedule kinds: "cron" has expr, "at" has at (one-time date)
  const cronExpr = job.schedule.expr ?? "";
  const atDate = (job.schedule as any).at as string | undefined;

  let scheduleText = "";
  if (cronExpr) {
    scheduleText = describeCron(cronExpr);
  } else if (atDate) {
    scheduleText = `Once at ${new Date(atDate).toLocaleString()}`;
  } else {
    scheduleText = job.schedule.kind ?? "unknown";
  }

  const fullPrompt = job.payload?.message ?? "";
  const payloadSummary = fullPrompt
    ? fullPrompt.slice(0, 200) + (fullPrompt.length > 200 ? "..." : "")
    : `${job.payload?.kind ?? "unknown"} (${job.agentId})`;

  const nextRunAt = job.state?.nextRunAtMs
    ?? (atDate ? new Date(atDate).getTime() : undefined)
    ?? (job.enabled && cronExpr ? getNextCronOccurrence(cronExpr, Date.now()) ?? undefined : undefined);

  return {
    id: job.id,
    name: job.name,
    source: "openclaw",
    enabled: job.enabled,
    cronExpr,
    scheduleText,
    agentId: job.agentId,
    agentName: job.agentId,
    lastRunAt: job.state?.lastRunAtMs,
    nextRunAt,
    lastStatus: mapLastStatus(job.state?.lastStatus),
    lastError: job.state?.lastError,
    command: payloadSummary,
    fullPrompt,
    model: job.payload?.model,
    timezone: job.schedule.tz,
    payloadKind: job.payload?.kind,
    sessionTarget: job.sessionTarget,
    wakeMode: job.wakeMode,
    deliveryMode: job.delivery?.mode,
    lastDurationMs: job.state?.lastDurationMs,
    createdAt: job.createdAtMs,
    updatedAt: job.updatedAtMs,
  };
}

export function schedulingRoutes(db: Db) {
  const router = Router();
  const cronSvc = openclawCronService();

  // List all scheduled jobs (OpenClaw + Paperclip recurring)
  router.get("/companies/:companyId/scheduling/jobs", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    // 1. Load OpenClaw cron jobs
    const openclawJobs = await cronSvc.loadCronJobs();
    const mappedOcJobs = openclawJobs.map(mapOpenClawJob);

    // 2. Load Paperclip recurring issues
    const recurringIssues = await db
      .select({
        issue: issues,
        agent: agents,
        project: projects,
      })
      .from(issues)
      .leftJoin(agents, eq(issues.assigneeAgentId, agents.id))
      .leftJoin(projects, eq(issues.projectId, projects.id))
      .where(
        and(
          eq(issues.companyId, companyId),
          eq(issues.recurrenceEnabled, true),
        ),
      );

    const paperclipJobs: UnifiedScheduledJob[] = recurringIssues.map(({ issue, agent, project }) => {
      const cronExpr = issue.recurrenceCronExpr ?? "";
      return {
        id: `paperclip:${issue.id}`,
        name: issue.title,
        source: "paperclip" as const,
        enabled: issue.recurrenceEnabled,
        cronExpr,
        scheduleText: issue.recurrenceText ?? (cronExpr ? describeCron(cronExpr) : ""),
        agentId: agent?.id ?? undefined,
        agentName: agent?.name ?? undefined,
        lastRunAt: issue.recurrenceLastSpawnedAt?.getTime() ?? undefined,
        nextRunAt: cronExpr ? getNextCronOccurrence(cronExpr, Date.now()) ?? undefined : undefined,
        issueId: issue.id,
        issueIdentifier: issue.identifier ?? undefined,
        issueStatus: issue.status,
        priority: issue.priority,
        projectName: project?.name ?? undefined,
      };
    });

    const jobs = [...mappedOcJobs, ...paperclipJobs];
    res.json({ jobs });
  });

  // Run history for an OpenClaw job
  router.get("/companies/:companyId/scheduling/history", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const jobId = req.query.jobId as string;
    if (!jobId) {
      res.status(400).json({ error: "jobId required" });
      return;
    }

    const page = parseInt(req.query.page as string) || 0;
    const result = await cronSvc.loadRunHistory(jobId, page);
    res.json(result);
  });

  // Toggle an OpenClaw cron job
  router.post("/companies/:companyId/scheduling/toggle", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const { jobId, enabled } = req.body as { jobId: string; enabled: boolean };
    if (!jobId || typeof enabled !== "boolean") {
      res.status(400).json({ error: "jobId and enabled required" });
      return;
    }

    const success = await cronSvc.toggleJob(jobId, enabled);
    if (!success) {
      res.status(404).json({ error: "Job not found" });
      return;
    }
    res.json({ ok: true, enabled });
  });

  return router;
}
