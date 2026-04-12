import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  agents,
  companies,
  createDb,
} from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import {
  QA_RELEASE_DEFAULT_NAME,
  QA_RELEASE_DEFAULT_TITLE,
  agentHeartbeatModelService,
} from "../services/agent-heartbeat-model.js";
import { agentInstructionsService } from "../services/agent-instructions.js";
import { loadDefaultAgentInstructionsBundle } from "../services/default-agent-instructions.js";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres QA coverage tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

describeEmbeddedPostgres("agentHeartbeatModelService QA coverage", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;
  const cleanupDirs = new Set<string>();
  const originalPaperclipHome = process.env.PAPERCLIP_HOME;
  const originalPaperclipInstanceId = process.env.PAPERCLIP_INSTANCE_ID;

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-agent-heartbeat-model-qa-");
    db = createDb(tempDb.connectionString);
  }, 20_000);

  afterEach(async () => {
    if (originalPaperclipHome === undefined) delete process.env.PAPERCLIP_HOME;
    else process.env.PAPERCLIP_HOME = originalPaperclipHome;
    if (originalPaperclipInstanceId === undefined) delete process.env.PAPERCLIP_INSTANCE_ID;
    else process.env.PAPERCLIP_INSTANCE_ID = originalPaperclipInstanceId;

    await db.delete(agents);
    await db.delete(companies);

    await Promise.all([...cleanupDirs].map(async (dir) => {
      await fs.rm(dir, { recursive: true, force: true });
      cleanupDirs.delete(dir);
    }));
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  it("backfills QA and Release Engineer for tech-team companies missing QA", async () => {
    const paperclipHome = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-agent-heartbeat-model-qa-home-"));
    cleanupDirs.add(paperclipHome);
    process.env.PAPERCLIP_HOME = paperclipHome;
    process.env.PAPERCLIP_INSTANCE_ID = "agent-heartbeat-model-qa-test";

    const companyId = "11111111-1111-4111-8111-111111111111";
    const ceoId = "22222222-2222-4222-8222-222222222222";
    const engineerId = "33333333-3333-4333-8333-333333333333";

    await db.insert(companies).values({
      id: companyId,
      name: "PrivateClip",
      issuePrefix: "PAP",
      requireBoardApprovalForNewAgents: false,
    });

    await db.insert(agents).values([
      {
        id: ceoId,
        companyId,
        name: "CEO",
        role: "ceo",
        status: "idle",
        adapterType: "codex_local",
        adapterConfig: { model: "gpt-5.4" },
        runtimeConfig: {},
        permissions: {},
      },
      {
        id: engineerId,
        companyId,
        name: "Engineer",
        role: "engineer",
        reportsTo: ceoId,
        status: "idle",
        adapterType: "codex_local",
        adapterConfig: {
          model: "gpt-5.4",
          instructionsBundleMode: "managed",
          instructionsRootPath: "/tmp/legacy",
          promptTemplate: "legacy prompt",
        },
        runtimeConfig: {},
        permissions: {},
      },
    ]);

    const svc = agentHeartbeatModelService(db);
    const report = await svc.backfillMissingQaReleaseEngineers({ apply: true });

    expect(report.scannedCompanies).toBe(1);
    expect(report.companiesWithTechTeam).toBe(1);
    expect(report.companiesWithQa).toBe(0);
    expect(report.companiesMissingQa).toBe(1);
    expect(report.createdAgents).toBe(1);
    expect(report.createdCompanyIds).toEqual([companyId]);

    const qaAgent = await db
      .select()
      .from(agents)
      .where(eq(agents.companyId, companyId))
      .then((rows) => rows.find((row) => row.role === "qa") ?? null);

    expect(qaAgent).not.toBeNull();
    expect(qaAgent?.name).toBe(QA_RELEASE_DEFAULT_NAME);
    expect(qaAgent?.title).toBe(QA_RELEASE_DEFAULT_TITLE);
    expect(qaAgent?.reportsTo).toBe(ceoId);
    expect(qaAgent?.adapterType).toBe("codex_local");
    expect((qaAgent?.adapterConfig as Record<string, unknown>).model).toBe("gpt-5.4");
    expect((qaAgent?.adapterConfig as Record<string, unknown>).promptTemplate).toBeUndefined();
    expect((qaAgent?.adapterConfig as Record<string, unknown>).instructionsBundleMode).toBe("managed");

    const instructions = agentInstructionsService();
    const files = await instructions.exportFiles(qaAgent!);
    const expectedQaBundle = await loadDefaultAgentInstructionsBundle("qa");
    expect(files.files).toEqual(expectedQaBundle);
  });

  it("skips companies that do not have a tech team", async () => {
    const companyId = "44444444-4444-4444-8444-444444444444";

    await db.insert(companies).values({
      id: companyId,
      name: "No Tech Team Co",
      issuePrefix: "NTC",
      requireBoardApprovalForNewAgents: false,
    });

    await db.insert(agents).values({
      id: "55555555-5555-4555-8555-555555555555",
      companyId,
      name: "CEO",
      role: "ceo",
      status: "idle",
      adapterType: "codex_local",
      adapterConfig: { model: "gpt-5.4" },
      runtimeConfig: {},
      permissions: {},
    });

    const svc = agentHeartbeatModelService(db);
    const report = await svc.backfillMissingQaReleaseEngineers({ apply: true });

    expect(report.scannedCompanies).toBe(1);
    expect(report.companiesWithTechTeam).toBe(0);
    expect(report.companiesSkippedNoTechTeam).toBe(1);
    expect(report.createdAgents).toBe(0);

    const qaAgents = await db
      .select()
      .from(agents)
      .where(eq(agents.companyId, companyId))
      .then((rows) => rows.filter((row) => row.role === "qa"));
    expect(qaAgents).toHaveLength(0);
  });
});
