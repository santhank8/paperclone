import { createDb } from "./client.js";
import {
  companies,
  agents,
  goals,
  projects,
  projectWorkspaces,
  issues,
  budgetPolicies,
} from "./schema/index.js";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");

const db = createDb(url);

console.log("Seeding Emisso Factory...");

// ── Company ──────────────────────────────────────────────────────────
const [company] = await db
  .insert(companies)
  .values({
    name: "Emisso Factory",
    description:
      "AI-native software factory — engineering, sales, and marketing agents",
    status: "active",
    budgetMonthlyCents: 100_000,
  })
  .returning();

// ── Agents ───────────────────────────────────────────────────────────
const [engineer] = await db
  .insert(agents)
  .values({
    companyId: company!.id,
    name: "Engineer",
    role: "engineer",
    title: "Software Engineer",
    icon: "code",
    status: "idle",
    adapterType: "emisso_sandbox",
    adapterConfig: {
      model: "claude-sonnet-4-6",
      vcpus: 2,
      timeoutSec: 180,
      maxTurns: 30,
      repoUrl: "https://github.com/emisso-ai/emisso-hq.git",
      cloneDepth: 1,
    },
    runtimeConfig: { heartbeat: { enabled: false } },
    budgetMonthlyCents: 50_000,
  })
  .returning();

const [sdr] = await db
  .insert(agents)
  .values({
    companyId: company!.id,
    name: "SDR",
    role: "general",
    title: "Sales Development Representative",
    icon: "mail",
    status: "idle",
    adapterType: "emisso_sandbox",
    adapterConfig: {
      model: "claude-sonnet-4-6",
      vcpus: 2,
      timeoutSec: 120,
      maxTurns: 20,
      repoUrl: "https://github.com/emisso-ai/emisso-hq.git",
      cloneDepth: 1,
      promptTemplate:
        "You are {{agent.name}}, an SDR agent for Emisso. You manage the folder-native CRM at sdr/. Read sdr/config/icp.yml and sdr/config/tone.md before any action. Follow the /sdr skill instructions. Continue your Paperclip work.",
    },
    runtimeConfig: { heartbeat: { enabled: false } },
    budgetMonthlyCents: 25_000,
  })
  .returning();

const [marketing] = await db
  .insert(agents)
  .values({
    companyId: company!.id,
    name: "Marketing",
    role: "general",
    title: "Marketing Specialist",
    icon: "sparkles",
    status: "idle",
    adapterType: "emisso_sandbox",
    adapterConfig: {
      model: "claude-sonnet-4-6",
      vcpus: 2,
      timeoutSec: 120,
      maxTurns: 20,
      repoUrl: "https://github.com/emisso-ai/emisso-hq.git",
      cloneDepth: 1,
      promptTemplate:
        "You are {{agent.name}}, a marketing agent for Emisso. You have access to the full product codebase and docs to create content, write blog posts, draft social media, and produce marketing materials. Continue your Paperclip work.",
    },
    runtimeConfig: { heartbeat: { enabled: false } },
    budgetMonthlyCents: 25_000,
  })
  .returning();

// ── Goal ─────────────────────────────────────────────────────────────
const [goal] = await db
  .insert(goals)
  .values({
    companyId: company!.id,
    title: "Launch AI Software Factory",
    description:
      "Ship emisso-os as the control plane for autonomous agents",
    level: "company",
    status: "active",
  })
  .returning();

// ── Project + Workspace ──────────────────────────────────────────────
const [project] = await db
  .insert(projects)
  .values({
    companyId: company!.id,
    goalId: goal!.id,
    name: "Emisso Platform",
    description: "Main product development and go-to-market",
    status: "in_progress",
  })
  .returning();

await db.insert(projectWorkspaces).values({
  companyId: company!.id,
  projectId: project!.id,
  name: "emisso-hq",
  sourceType: "git_remote",
  repoUrl: "https://github.com/emisso-ai/emisso-hq.git",
  repoRef: "main",
  isPrimary: true,
});

// ── Issues ───────────────────────────────────────────────────────────
await db.insert(issues).values([
  {
    companyId: company!.id,
    projectId: project!.id,
    goalId: goal!.id,
    title: "Set up CI/CD pipeline for emisso-os",
    description:
      "Configure GitHub Actions for build, typecheck, lint, and test on every PR",
    status: "todo",
    priority: "high",
    assigneeAgentId: engineer!.id,
  },
  {
    companyId: company!.id,
    projectId: project!.id,
    goalId: goal!.id,
    title: "Run full SDR pipeline — prospect and draft outreach",
    description:
      "Execute a full /sdr pipeline run: scan leads, enrich due companies, draft outreach emails",
    status: "todo",
    priority: "medium",
    assigneeAgentId: sdr!.id,
  },
  {
    companyId: company!.id,
    projectId: project!.id,
    goalId: goal!.id,
    title: "Write launch blog post for emisso-os",
    description:
      "Draft a technical blog post announcing emisso-os as an open-source control plane for autonomous agents",
    status: "todo",
    priority: "medium",
    assigneeAgentId: marketing!.id,
  },
]);

// ── Budget Policies ──────────────────────────────────────────────────
await db.insert(budgetPolicies).values([
  {
    companyId: company!.id,
    scopeType: "company",
    scopeId: company!.id,
    metric: "billed_cents",
    windowKind: "calendar_month_utc",
    amount: 100_000,
    warnPercent: 80,
    hardStopEnabled: true,
  },
  {
    companyId: company!.id,
    scopeType: "agent",
    scopeId: engineer!.id,
    metric: "billed_cents",
    windowKind: "calendar_month_utc",
    amount: 50_000,
    warnPercent: 80,
    hardStopEnabled: true,
  },
]);

console.log("Seed complete — Emisso Factory created");
console.log(`  Company: ${company!.id}`);
console.log(`  Agents:  Engineer (${engineer!.id}), SDR (${sdr!.id}), Marketing (${marketing!.id})`);
console.log(`  Project: ${project!.id}`);
process.exit(0);
