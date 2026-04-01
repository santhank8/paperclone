import { randomUUID } from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  applyPendingMigrations,
  createDb,
  ensurePostgresDatabase,
  agents,
  agentWakeupRequests,
  companies,
  heartbeatRunEvents,
  heartbeatRuns,
  issues,
} from "@paperclipai/db";
import { runningProcesses } from "../adapters/index.ts";
import { heartbeatService } from "../services/heartbeat.ts";

type EmbeddedPostgresInstance = {
  initialise(): Promise<void>;
  start(): Promise<void>;
  stop(): Promise<void>;
};

type EmbeddedPostgresCtor = new (opts: {
  databaseDir: string;
  user: string;
  password: string;
  port: number;
  persistent: boolean;
  initdbFlags?: string[];
  onLog?: (message: unknown) => void;
  onError?: (message: unknown) => void;
}) => EmbeddedPostgresInstance;

async function getEmbeddedPostgresCtor(): Promise<EmbeddedPostgresCtor> {
  const mod = await import("embedded-postgres");
  return mod.default as EmbeddedPostgresCtor;
}

async function getAvailablePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to allocate test port")));
        return;
      }
      const { port } = address;
      server.close((error) => {
        if (error) reject(error);
        else resolve(port);
      });
    });
  });
}

async function startTempDatabase() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "paperclip-heartbeat-recovery-"));
  const port = await getAvailablePort();
  const EmbeddedPostgres = await getEmbeddedPostgresCtor();
  const instance = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: "paperclip",
    password: "paperclip",
    port,
    persistent: true,
    initdbFlags: ["--encoding=UTF8", "--locale=C", "--lc-messages=C"],
    onLog: () => {},
    onError: () => {},
  });
  await instance.initialise();
  await instance.start();

  const adminConnectionString = `postgres://paperclip:paperclip@127.0.0.1:${port}/postgres`;
  await ensurePostgresDatabase(adminConnectionString, "paperclip");
  const connectionString = `postgres://paperclip:paperclip@127.0.0.1:${port}/paperclip`;
  await applyPendingMigrations(connectionString);
  return { connectionString, instance, dataDir };
}

function spawnAliveProcess() {
  return spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
    stdio: "ignore",
  });
}

describe("heartbeat orphaned process recovery", () => {
  let db!: ReturnType<typeof createDb>;
  let instance: EmbeddedPostgresInstance | null = null;
  let dataDir = "";
  const childProcesses = new Set<ChildProcess>();

  beforeAll(async () => {
    const started = await startTempDatabase();
    db = createDb(started.connectionString);
    instance = started.instance;
    dataDir = started.dataDir;
  }, 20_000);

  afterEach(async () => {
    runningProcesses.clear();
    for (const child of childProcesses) {
      child.kill("SIGKILL");
    }
    childProcesses.clear();
    await db.delete(issues);
    await db.delete(heartbeatRunEvents);
    await db.delete(heartbeatRuns);
    await db.delete(agentWakeupRequests);
    await db.delete(agents);
    await db.delete(companies);
  });

  afterAll(async () => {
    for (const child of childProcesses) {
      child.kill("SIGKILL");
    }
    childProcesses.clear();
    runningProcesses.clear();
    await instance?.stop();
    if (dataDir) {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });

  async function seedRunFixture(input?: {
    adapterType?: string;
    agentStatus?: "idle" | "running" | "paused" | "error" | "terminated" | "pending_approval";
    runStatus?: "running" | "queued" | "failed";
    processPid?: number | null;
    processLossRetryCount?: number;
    includeIssue?: boolean;
    runErrorCode?: string | null;
    runError?: string | null;
    createdAt?: Date;
    startedAt?: Date;
    updatedAt?: Date;
    processStartedAt?: Date | null;
  }) {
    const companyId = randomUUID();
    const agentId = randomUUID();
    const runId = randomUUID();
    const wakeupRequestId = randomUUID();
    const issueId = randomUUID();
    const now = input?.startedAt ?? new Date("2026-03-19T00:00:00.000Z");
    const createdAt = input?.createdAt ?? now;
    const updatedAt = input?.updatedAt ?? now;
    const issuePrefix = `T${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`;

    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix,
      requireBoardApprovalForNewAgents: false,
    });

    await db.insert(agents).values({
      id: agentId,
      companyId,
      name: "CodexCoder",
      role: "engineer",
      status: input?.agentStatus ?? "paused",
      adapterType: input?.adapterType ?? "codex_local",
      adapterConfig: {},
      runtimeConfig: {},
      permissions: {},
    });

    await db.insert(agentWakeupRequests).values({
      id: wakeupRequestId,
      companyId,
      agentId,
      source: "assignment",
      triggerDetail: "system",
      reason: "issue_assigned",
      payload: input?.includeIssue === false ? {} : { issueId },
      status: "claimed",
      runId,
      claimedAt: now,
    });

    await db.insert(heartbeatRuns).values({
      id: runId,
      companyId,
      agentId,
      invocationSource: "assignment",
      triggerDetail: "system",
      status: input?.runStatus ?? "running",
      wakeupRequestId,
      contextSnapshot: input?.includeIssue === false ? {} : { issueId },
      processPid: input?.processPid ?? null,
      processStartedAt: input?.processStartedAt ?? null,
      processLossRetryCount: input?.processLossRetryCount ?? 0,
      errorCode: input?.runErrorCode ?? null,
      error: input?.runError ?? null,
      createdAt,
      startedAt: now,
      updatedAt,
    });

    if (input?.includeIssue !== false) {
      await db.insert(issues).values({
        id: issueId,
        companyId,
        title: "Recover local adapter after lost process",
        status: "in_progress",
        priority: "medium",
        assigneeAgentId: agentId,
        checkoutRunId: runId,
        executionRunId: runId,
        issueNumber: 1,
        identifier: `${issuePrefix}-1`,
      });
    }

    return { companyId, agentId, runId, wakeupRequestId, issueId };
  }

  it("keeps a local run active when the recorded pid is still alive", async () => {
    const child = spawnAliveProcess();
    childProcesses.add(child);
    expect(child.pid).toBeTypeOf("number");
    const activeAt = new Date();

    const { runId, wakeupRequestId } = await seedRunFixture({
      processPid: child.pid ?? null,
      includeIssue: false,
      startedAt: activeAt,
      updatedAt: activeAt,
      processStartedAt: activeAt,
    });
    const heartbeat = heartbeatService(db);

    const result = await heartbeat.reapOrphanedRuns();
    expect(result.reaped).toBe(0);

    const run = await heartbeat.getRun(runId);
    expect(run?.status).toBe("running");
    expect(run?.errorCode).toBe("process_detached");
    expect(run?.error).toContain(String(child.pid));

    const wakeup = await db
      .select()
      .from(agentWakeupRequests)
      .where(eq(agentWakeupRequests.id, wakeupRequestId))
      .then((rows) => rows[0] ?? null);
    expect(wakeup?.status).toBe("claimed");
  });

  it("cancels a stale local run even if the child process is still being tracked", async () => {
    const child = spawnAliveProcess();
    childProcesses.add(child);
    expect(child.pid).toBeTypeOf("number");

    const { runId, wakeupRequestId } = await seedRunFixture({
      processPid: child.pid ?? null,
      includeIssue: false,
    });
    runningProcesses.set(runId, { child, graceSec: 1 });
    const heartbeat = heartbeatService(db);

    const result = await heartbeat.reapOrphanedRuns({ staleThresholdMs: 5 * 60 * 1000 });
    expect(result.reaped).toBe(1);
    expect(result.runIds).toEqual([runId]);

    const run = await heartbeat.getRun(runId);
    expect(run?.status).toBe("cancelled");
    expect(run?.errorCode).toBe("cancelled");
    expect(run?.error).toContain("Cancelled stale run after 30 minutes without reported activity");

    const wakeup = await db
      .select()
      .from(agentWakeupRequests)
      .where(eq(agentWakeupRequests.id, wakeupRequestId))
      .then((rows) => rows[0] ?? null);
    expect(wakeup?.status).toBe("cancelled");
  });

  it("queues exactly one retry when the recorded local pid is dead", async () => {
    const { agentId, runId, issueId } = await seedRunFixture({
      processPid: 999_999_999,
    });
    const heartbeat = heartbeatService(db);

    const result = await heartbeat.reapOrphanedRuns();
    expect(result.reaped).toBe(1);
    expect(result.runIds).toEqual([runId]);

    const runs = await db
      .select()
      .from(heartbeatRuns)
      .where(eq(heartbeatRuns.agentId, agentId));
    expect(runs).toHaveLength(2);

    const failedRun = runs.find((row) => row.id === runId);
    const retryRun = runs.find((row) => row.id !== runId);
    expect(failedRun?.status).toBe("failed");
    expect(failedRun?.errorCode).toBe("process_lost");
    expect(retryRun?.status).toBe("queued");
    expect(retryRun?.retryOfRunId).toBe(runId);
    expect(retryRun?.processLossRetryCount).toBe(1);

    const issue = await db
      .select()
      .from(issues)
      .where(eq(issues.id, issueId))
      .then((rows) => rows[0] ?? null);
    expect(issue?.executionRunId).toBe(retryRun?.id ?? null);
    expect(issue?.checkoutRunId).toBe(runId);
  });

  it("does not queue a second retry after the first process-loss retry was already used", async () => {
    const { agentId, runId, issueId } = await seedRunFixture({
      processPid: 999_999_999,
      processLossRetryCount: 1,
    });
    const heartbeat = heartbeatService(db);

    const result = await heartbeat.reapOrphanedRuns();
    expect(result.reaped).toBe(1);
    expect(result.runIds).toEqual([runId]);

    const runs = await db
      .select()
      .from(heartbeatRuns)
      .where(eq(heartbeatRuns.agentId, agentId));
    expect(runs).toHaveLength(1);
    expect(runs[0]?.status).toBe("failed");

    const issue = await db
      .select()
      .from(issues)
      .where(eq(issues.id, issueId))
      .then((rows) => rows[0] ?? null);
    expect(issue?.executionRunId).toBeNull();
    expect(issue?.checkoutRunId).toBe(runId);
  });

  it("clears the detached warning when the run reports activity again", async () => {
    const { runId } = await seedRunFixture({
      includeIssue: false,
      runErrorCode: "process_detached",
      runError: "Lost in-memory process handle, but child pid 123 is still alive",
    });
    const heartbeat = heartbeatService(db);

    const updated = await heartbeat.reportRunActivity(runId);
    expect(updated?.errorCode).toBeNull();
    expect(updated?.error).toBeNull();

    const run = await heartbeat.getRun(runId);
    expect(run?.errorCode).toBeNull();
    expect(run?.error).toBeNull();
  });

  it("promotes deferred issue execution for the current assignee before older deferred wakes", async () => {
    const companyId = randomUUID();
    const currentAgentId = randomUUID();
    const assigneeAgentId = randomUUID();
    const otherAgentId = randomUUID();
    const issueId = randomUUID();
    const currentRunId = randomUUID();
    const currentWakeupId = randomUUID();
    const assigneeBlockingRunId = randomUUID();
    const assigneeBlockingWakeupId = randomUUID();
    const olderDeferredWakeupId = randomUUID();
    const assigneeDeferredWakeupId = randomUUID();
    const now = new Date("2026-03-19T00:00:00.000Z");
    const issuePrefix = `T${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`;

    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix,
      requireBoardApprovalForNewAgents: false,
    });

    await db.insert(agents).values([
      {
        id: currentAgentId,
        companyId,
        name: "CurrentAgent",
        role: "engineer",
        status: "paused",
        adapterType: "codex_local",
        adapterConfig: {},
        runtimeConfig: {},
        permissions: {},
      },
      {
        id: assigneeAgentId,
        companyId,
        name: "AssigneeAgent",
        role: "engineer",
        status: "running",
        adapterType: "codex_local",
        adapterConfig: {},
        runtimeConfig: {
          heartbeat: {
            maxConcurrentRuns: 1,
          },
        },
        permissions: {},
      },
      {
        id: otherAgentId,
        companyId,
        name: "OtherAgent",
        role: "engineer",
        status: "idle",
        adapterType: "codex_local",
        adapterConfig: {},
        runtimeConfig: {},
        permissions: {},
      },
    ]);

    await db.insert(agentWakeupRequests).values([
      {
        id: currentWakeupId,
        companyId,
        agentId: currentAgentId,
        source: "assignment",
        triggerDetail: "system",
        reason: "issue_assigned",
        payload: { issueId },
        status: "claimed",
        runId: currentRunId,
        claimedAt: now,
      },
      {
        id: assigneeBlockingWakeupId,
        companyId,
        agentId: assigneeAgentId,
        source: "assignment",
        triggerDetail: "system",
        reason: "other_issue",
        payload: { issueId: randomUUID() },
        status: "claimed",
        runId: assigneeBlockingRunId,
        claimedAt: now,
      },
      {
        id: olderDeferredWakeupId,
        companyId,
        agentId: otherAgentId,
        source: "automation",
        triggerDetail: "system",
        reason: "issue_waiting",
        payload: { issueId },
        status: "deferred_issue_execution",
        requestedAt: new Date("2026-03-19T00:01:00.000Z"),
      },
      {
        id: assigneeDeferredWakeupId,
        companyId,
        agentId: assigneeAgentId,
        source: "automation",
        triggerDetail: "system",
        reason: "issue_waiting",
        payload: { issueId },
        status: "deferred_issue_execution",
        requestedAt: new Date("2026-03-19T00:02:00.000Z"),
      },
    ]);

    await db.insert(heartbeatRuns).values([
      {
        id: currentRunId,
        companyId,
        agentId: currentAgentId,
        invocationSource: "assignment",
        triggerDetail: "system",
        status: "running",
        wakeupRequestId: currentWakeupId,
        contextSnapshot: { issueId },
        startedAt: now,
        updatedAt: now,
      },
      {
        id: assigneeBlockingRunId,
        companyId,
        agentId: assigneeAgentId,
        invocationSource: "assignment",
        triggerDetail: "system",
        status: "running",
        wakeupRequestId: assigneeBlockingWakeupId,
        contextSnapshot: { issueId: randomUUID() },
        startedAt: now,
        updatedAt: now,
      },
    ]);

    await db.insert(issues).values({
      id: issueId,
      companyId,
      title: "Prefer assignee for deferred promotion",
      status: "in_progress",
      priority: "medium",
      assigneeAgentId,
      checkoutRunId: currentRunId,
      executionRunId: currentRunId,
      issueNumber: 1,
      identifier: `${issuePrefix}-1`,
    });

    const heartbeat = heartbeatService(db);
    await heartbeat.cancelRun(currentRunId);

    const issue = await db
      .select()
      .from(issues)
      .where(eq(issues.id, issueId))
      .then((rows) => rows[0] ?? null);
    expect(issue?.executionRunId).not.toBeNull();
    expect(issue?.executionRunId).not.toBe(currentRunId);

    const promotedRun = await db
      .select()
      .from(heartbeatRuns)
      .where(eq(heartbeatRuns.id, issue?.executionRunId ?? ""))
      .then((rows) => rows[0] ?? null);
    expect(promotedRun?.agentId).toBe(assigneeAgentId);
    expect(promotedRun?.wakeupRequestId).toBe(assigneeDeferredWakeupId);
    expect(promotedRun?.status).toBe("queued");

    const deferredWakeups = await db
      .select()
      .from(agentWakeupRequests)
      .where(eq(agentWakeupRequests.companyId, companyId));
    const olderDeferred = deferredWakeups.find((row) => row.id === olderDeferredWakeupId);
    const assigneeDeferred = deferredWakeups.find((row) => row.id === assigneeDeferredWakeupId);

    expect(olderDeferred?.status).toBe("failed");
    expect(olderDeferred?.error).toBe("Deferred wake superseded by current issue assignee");
    expect(assigneeDeferred?.status).toBe("queued");
    expect(assigneeDeferred?.runId).toBe(promotedRun?.id ?? null);
    expect(assigneeDeferred?.reason).toBe("issue_execution_promoted");
  });
});
