import { randomUUID } from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { and, desc, eq, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  agents,
  agentWakeupRequests,
  applyPendingMigrations,
  companies,
  createDb,
  ensurePostgresDatabase,
  heartbeatRuns,
  issues,
} from "@paperclipai/db";
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
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "paperclip-wakeup-recovery-"));
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

describe("heartbeat queued wakeup recovery", () => {
  let db!: ReturnType<typeof createDb>;
  let instance: EmbeddedPostgresInstance | null = null;
  let dataDir = "";

  beforeAll(async () => {
    const started = await startTempDatabase();
    db = createDb(started.connectionString);
    instance = started.instance;
    dataDir = started.dataDir;
  }, 20_000);

  afterEach(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    await db.execute(sql`truncate table companies cascade`);
  });

  afterAll(async () => {
    await instance?.stop();
    if (dataDir) {
      fs.rmSync(dataDir, { recursive: true, force: true });
    }
  });

  async function seedAssignedIssue() {
    const companyId = randomUUID();
    const agentId = randomUUID();
    const issueId = randomUUID();
    const issuePrefix = `T${companyId.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
    const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), "paperclip-process-adapter-"));

    await db.insert(companies).values({
      id: companyId,
      name: "Paperclip",
      issuePrefix,
      requireBoardApprovalForNewAgents: false,
    });

    await db.insert(agents).values({
      id: agentId,
      companyId,
      name: "WakeupTester",
      role: "engineer",
      status: "idle",
      adapterType: "process",
      adapterConfig: {
        command: "/bin/sh",
        args: ["-lc", "exit 0"],
        cwd: workspaceDir,
      },
      runtimeConfig: {
        heartbeat: {
          enabled: true,
          intervalSec: 0,
          maxConcurrentRuns: 1,
        },
      },
      permissions: {},
    });

    await db.insert(issues).values({
      id: issueId,
      companyId,
      title: "Wake the assignee",
      status: "todo",
      priority: "high",
      assigneeAgentId: agentId,
      issueNumber: 1,
      identifier: `${issuePrefix}-1`,
    });

    return { companyId, agentId, issueId };
  }

  it("materializes a run immediately for issue assignment wakeups", async () => {
    const { agentId, issueId } = await seedAssignedIssue();
    const heartbeat = heartbeatService(db);

    const replayed = await heartbeat.wakeup(agentId, {
      source: "assignment",
      triggerDetail: "system",
      reason: "issue_assigned",
      payload: { issueId, mutation: "create" },
      contextSnapshot: { issueId, source: "test.issue.create" },
    });

    const wakeupRequest = await db
      .select()
      .from(agentWakeupRequests)
      .where(and(eq(agentWakeupRequests.agentId, agentId), eq(agentWakeupRequests.reason, "issue_assigned")))
      .orderBy(desc(agentWakeupRequests.requestedAt))
      .then((rows) => rows[0] ?? null);

    const replayedRunId =
      typeof replayed === "object" && replayed !== null && "id" in replayed
        ? (replayed as { id: string }).id
        : null;

    expect(replayedRunId).toBeTruthy();
    expect(wakeupRequest?.runId).toBeTruthy();
    expect(wakeupRequest?.runId).toBe(replayedRunId);
  });

  it("replays orphaned issue wakeups that were left queued without a run", async () => {
    const { companyId, agentId, issueId } = await seedAssignedIssue();
    const heartbeat = heartbeatService(db);
    const orphanedWakeupId = randomUUID();

    await db.insert(agentWakeupRequests).values({
      id: orphanedWakeupId,
      companyId,
      agentId,
      source: "assignment",
      triggerDetail: "system",
      reason: "issue_assigned",
      payload: { issueId, mutation: "create" },
      status: "queued",
    });

    await heartbeat.resumeQueuedRuns();

    const orphanedWakeup = await db
      .select()
      .from(agentWakeupRequests)
      .where(eq(agentWakeupRequests.id, orphanedWakeupId))
      .then((rows) => rows[0] ?? null);

    const replayedWakeup = await db
      .select()
      .from(agentWakeupRequests)
      .where(
        and(
          eq(agentWakeupRequests.agentId, agentId),
          eq(agentWakeupRequests.reason, "issue_assigned"),
        ),
      )
      .orderBy(desc(agentWakeupRequests.requestedAt))
      .then((rows) => rows[0] ?? null);

    expect(orphanedWakeup?.status).toBe("coalesced");
    expect(orphanedWakeup?.runId).toBeTruthy();
    expect(replayedWakeup?.id).not.toBe(orphanedWakeupId);
    expect(replayedWakeup?.runId).toBeTruthy();

    const replayedRun = await db
      .select()
      .from(heartbeatRuns)
      .where(eq(heartbeatRuns.id, orphanedWakeup?.runId ?? ""))
      .then((rows) => rows[0] ?? null);

    expect(replayedRun).not.toBeNull();
  });
});
