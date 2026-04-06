/**
 * Verifies seeded virtual org setup creates one stable Officely knowledge-base automation layer.
 */
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  agentTemplates,
  agents,
  companies,
  companyProfiles,
  createDb,
  dataConnectors,
  insightCards,
  projects,
  routines,
  routineTriggers,
} from "@paperclipai/db";
import {
  getEmbeddedPostgresTestSupport,
  startEmbeddedPostgresTestDatabase,
} from "./helpers/embedded-postgres.js";
import { resolveServerRepoRoot } from "../services/repo-root.js";
import { virtualOrgService } from "../services/virtual-org.js";

const embeddedPostgresSupport = await getEmbeddedPostgresTestSupport();
const describeEmbeddedPostgres = embeddedPostgresSupport.supported ? describe : describe.skip;

if (!embeddedPostgresSupport.supported) {
  console.warn(
    `Skipping embedded Postgres virtual org service tests on this host: ${embeddedPostgresSupport.reason ?? "unsupported environment"}`,
  );
}

describeEmbeddedPostgres("virtual org service", () => {
  let db!: ReturnType<typeof createDb>;
  let tempDb: Awaited<ReturnType<typeof startEmbeddedPostgresTestDatabase>> | null = null;
  const originalPaperclipHome = process.env.PAPERCLIP_HOME;
  let paperclipHome = "";

  beforeAll(async () => {
    tempDb = await startEmbeddedPostgresTestDatabase("paperclip-virtual-org-");
    db = createDb(tempDb.connectionString);
  }, 20_000);

  afterEach(async () => {
    await db.delete(routineTriggers);
    await db.delete(routines);
    await db.delete(projects);
    await db.delete(agents);
    await db.delete(insightCards);
    await db.delete(dataConnectors);
    await db.delete(companyProfiles);
    await db.delete(agentTemplates);
    await db.delete(companies);

    if (paperclipHome) {
      await rm(paperclipHome, { recursive: true, force: true });
      paperclipHome = "";
    }
    if (originalPaperclipHome === undefined) delete process.env.PAPERCLIP_HOME;
    else process.env.PAPERCLIP_HOME = originalPaperclipHome;
  });

  afterAll(async () => {
    await tempDb?.cleanup();
  });

  it("creates one managed Officely knowledge agent, project, and scheduled routines", async () => {
    paperclipHome = await mkdtemp(path.join(os.tmpdir(), "paperclip-virtual-org-home-"));
    process.env.PAPERCLIP_HOME = paperclipHome;

    const svc = virtualOrgService(db);
    await svc.bootstrapDefaults();
    await svc.bootstrapDefaults();

    const officely = await db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.name, "Officely"))
      .then((rows) => rows[0] ?? null);
    expect(officely).not.toBeNull();

    const officelyAgents = await db
      .select()
      .from(agents)
      .where(eq(agents.companyId, officely!.id));
    const knowledgeAgent = officelyAgents.find((agent) => {
      const metadata = typeof agent.metadata === "object" && agent.metadata !== null ? agent.metadata : {};
      return (metadata as Record<string, unknown>).systemKey === "officely-kb-agent";
    });
    expect(knowledgeAgent).toBeTruthy();
    expect(officelyAgents.filter((agent) => agent.name === "Officely Knowledge Base")).toHaveLength(1);
    expect(knowledgeAgent?.adapterType).toBe("codex_local");
    expect((knowledgeAgent?.adapterConfig as Record<string, unknown>).instructionsBundleMode).toBe("managed");
    expect((knowledgeAgent?.adapterConfig as Record<string, unknown>).cwd).toBe(resolveServerRepoRoot());

    const knowledgeProjects = await db
      .select()
      .from(projects)
      .where(and(eq(projects.companyId, officely!.id), eq(projects.name, "Knowledge Base")));
    expect(knowledgeProjects).toHaveLength(1);

    const officelyRoutines = await db
      .select()
      .from(routines)
      .where(eq(routines.companyId, officely!.id));
    const compileRoutine = officelyRoutines.find((routine) => routine.title === "Compile Officely knowledge base");
    const lintRoutine = officelyRoutines.find((routine) => routine.title === "Lint Officely knowledge base");
    expect(compileRoutine).toBeTruthy();
    expect(lintRoutine).toBeTruthy();
    expect(officelyRoutines.filter((routine) => routine.title === "Compile Officely knowledge base")).toHaveLength(1);
    expect(officelyRoutines.filter((routine) => routine.title === "Lint Officely knowledge base")).toHaveLength(1);
    expect(compileRoutine?.assigneeAgentId).toBe(knowledgeAgent?.id);
    expect(lintRoutine?.assigneeAgentId).toBe(knowledgeAgent?.id);

    const compileTrigger = await db
      .select()
      .from(routineTriggers)
      .where(and(eq(routineTriggers.routineId, compileRoutine!.id), eq(routineTriggers.label, "Daily morning compile")))
      .then((rows) => rows[0] ?? null);
    const lintTrigger = await db
      .select()
      .from(routineTriggers)
      .where(and(eq(routineTriggers.routineId, lintRoutine!.id), eq(routineTriggers.label, "Friday quality check")))
      .then((rows) => rows[0] ?? null);

    expect(compileTrigger).toMatchObject({
      kind: "schedule",
      cronExpression: "0 7 * * *",
      timezone: "Australia/Melbourne",
      enabled: true,
    });
    expect(lintTrigger).toMatchObject({
      kind: "schedule",
      cronExpression: "0 16 * * 5",
      timezone: "Australia/Melbourne",
      enabled: true,
    });
  });

  it("does not take over a human project or routine with the same names", async () => {
    paperclipHome = await mkdtemp(path.join(os.tmpdir(), "paperclip-virtual-org-home-"));
    process.env.PAPERCLIP_HOME = paperclipHome;

    const officelyCompanyId = randomUUID();
    const manualAgentId = randomUUID();
    const manualProjectId = randomUUID();
    const manualCompileRoutineId = randomUUID();
    const manualLintRoutineId = randomUUID();

    await db.insert(companies).values({
      id: officelyCompanyId,
      name: "Officely",
      description: "Manual test company",
      issuePrefix: "OFF",
      requireBoardApprovalForNewAgents: false,
    });
    await db.insert(agents).values({
      id: manualAgentId,
      companyId: officelyCompanyId,
      name: "Founder Assistant",
      role: "general",
      status: "idle",
      adapterType: "codex_local",
      adapterConfig: {},
      runtimeConfig: {},
      permissions: {},
    });
    await db.insert(projects).values({
      id: manualProjectId,
      companyId: officelyCompanyId,
      name: "Knowledge Base",
      description: "Founder-owned notes project",
      status: "in_progress",
      leadAgentId: manualAgentId,
    });
    await db.insert(routines).values([
      {
        id: manualCompileRoutineId,
        companyId: officelyCompanyId,
        projectId: manualProjectId,
        title: "Compile Officely knowledge base",
        description: "Founder manual compile",
        assigneeAgentId: manualAgentId,
        priority: "medium",
        status: "active",
        concurrencyPolicy: "coalesce_if_active",
        catchUpPolicy: "skip_missed",
        variables: [],
      },
      {
        id: manualLintRoutineId,
        companyId: officelyCompanyId,
        projectId: manualProjectId,
        title: "Lint Officely knowledge base",
        description: "Founder manual lint",
        assigneeAgentId: manualAgentId,
        priority: "medium",
        status: "active",
        concurrencyPolicy: "coalesce_if_active",
        catchUpPolicy: "skip_missed",
        variables: [],
      },
    ]);

    const svc = virtualOrgService(db);
    await svc.bootstrapDefaults();
    await svc.bootstrapDefaults();

    const knowledgeAgent = await db
      .select()
      .from(agents)
      .where(eq(agents.companyId, officelyCompanyId))
      .then((rows) =>
        rows.find((agent) => {
          const metadata = typeof agent.metadata === "object" && agent.metadata !== null ? agent.metadata : {};
          return (metadata as Record<string, unknown>).systemKey === "officely-kb-agent";
        }) ?? null,
      );
    expect(knowledgeAgent).not.toBeNull();

    const refreshedManualProject = await db
      .select()
      .from(projects)
      .where(eq(projects.id, manualProjectId))
      .then((rows) => rows[0] ?? null);
    expect(refreshedManualProject).toMatchObject({
      leadAgentId: manualAgentId,
      description: "Founder-owned notes project",
    });

    const managedProjects = await db
      .select()
      .from(projects)
      .where(eq(projects.companyId, officelyCompanyId))
      .then((rows) =>
        rows.filter((project) =>
          project.leadAgentId === knowledgeAgent!.id
          && project.description === "Keeps the Officely company handbook fresh from saved snapshots and flags gaps for follow-up.",
        ),
      );
    expect(managedProjects).toHaveLength(1);

    const managedRoutines = await db
      .select()
      .from(routines)
      .where(eq(routines.companyId, officelyCompanyId))
      .then((rows) =>
        rows.filter((routine) =>
          routine.projectId === managedProjects[0]!.id
          && routine.assigneeAgentId === knowledgeAgent!.id,
        ),
      );
    expect(managedRoutines.filter((routine) => routine.title === "Compile Officely knowledge base")).toHaveLength(1);
    expect(managedRoutines.filter((routine) => routine.title === "Lint Officely knowledge base")).toHaveLength(1);
  });

  it("replaces a terminated managed agent instead of failing bootstrap", async () => {
    paperclipHome = await mkdtemp(path.join(os.tmpdir(), "paperclip-virtual-org-home-"));
    process.env.PAPERCLIP_HOME = paperclipHome;

    const svc = virtualOrgService(db);
    await svc.bootstrapDefaults();

    const officely = await db
      .select({ id: companies.id })
      .from(companies)
      .where(eq(companies.name, "Officely"))
      .then((rows) => rows[0] ?? null);
    expect(officely).not.toBeNull();

    const firstAgent = await db
      .select()
      .from(agents)
      .where(eq(agents.companyId, officely!.id))
      .then((rows) =>
        rows.find((agent) => {
          const metadata = typeof agent.metadata === "object" && agent.metadata !== null ? agent.metadata : {};
          return (metadata as Record<string, unknown>).systemKey === "officely-kb-agent";
        }) ?? null,
      );
    expect(firstAgent).not.toBeNull();

    await db
      .update(agents)
      .set({ status: "terminated" })
      .where(eq(agents.id, firstAgent!.id));

    await svc.bootstrapDefaults();

    const managedAgents = await db
      .select()
      .from(agents)
      .where(eq(agents.companyId, officely!.id))
      .then((rows) =>
        rows.filter((agent) => {
          const metadata = typeof agent.metadata === "object" && agent.metadata !== null ? agent.metadata : {};
          return (metadata as Record<string, unknown>).systemKey === "officely-kb-agent";
        }),
      );

    expect(managedAgents.filter((agent) => agent.status !== "terminated")).toHaveLength(1);
    expect(managedAgents.some((agent) => agent.id === firstAgent!.id && agent.status === "terminated")).toBe(true);
  });
});
