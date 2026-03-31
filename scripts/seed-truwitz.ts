/**
 * Seed script — creates the Truwitz company with all 16 Olympus agents.
 *
 * Each agent is a Claude Code instance (claude_local adapter) that runs
 * in the claw project directory, automatically inheriting all MCP servers
 * configured in /Users/nathanstewart/projects/claw/.claude/settings.local.json
 * (claw-social, claw-lead-gen, claw-workers, claw-manager, slack, postgres, redis, etc.)
 *
 * Usage:
 *   DATABASE_URL=postgres://clawdbot:clawdbot@localhost:5433/paperclip \
 *   npx tsx scripts/seed-truwitz.ts
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { createDb } from "../packages/db/src/client.js";
import { companies, agents } from "../packages/db/src/schema/index.js";

const __dir = path.dirname(fileURLToPath(import.meta.url));
const PAPERCLIP_ROOT = path.resolve(__dir, "..");
const CLAW_ROOT = "/Users/nathanstewart/projects/claw";
const INSTRUCTIONS_DIR = path.join(PAPERCLIP_ROOT, "agents", "instructions");

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");

const db = createDb(url);

// ── Shared claude_local base config ──────────────────────────────────────────
// cwd = claw project root → auto-picks up .claude/settings.local.json which
// has all MCP servers: claw-social, claw-lead-gen, claw-workers, claw-manager,
// slack, postgres, redis, github, exa, etc.

function claudeConfig(opts: {
  instructions: string;       // path to .md instructions file
  promptTemplate: string;     // heartbeat task prompt
  env?: Record<string, string>;
}) {
  return {
    command: "claude",
    cwd: CLAW_ROOT,
    instructionsFilePath: opts.instructions,
    promptTemplate: opts.promptTemplate,
    dangerouslySkipPermissions: true,
    maxTurnsPerRun: 30,
    env: {
      // Blank out ANTHROPIC_API_KEY so Claude Code uses subscription billing
      // (flat cost regardless of how many agents fire).
      // Remove this line if you want API token billing instead.
      ANTHROPIC_API_KEY: "",
      ...opts.env,
    },
  };
}

// ── Company ───────────────────────────────────────────────────────────────────

console.log("Seeding Truwitz company...");

const [company] = await db
  .insert(companies)
  .values({
    name: "Truwitz",
    description: [
      "Autonomous AI company — Olympus stack (Paperclip + Claw).",
      "Brands: Truwitz, Luna Luxe, CIO Daily Brief, Texas Butchers.",
      "Each agent is Claude Code running against Claw MCP servers.",
    ].join(" "),
    status: "active",
    budgetMonthlyCents: 200000,
  })
  .returning();

console.log("Created company:", company!.id);

// ── Chief of Staff ────────────────────────────────────────────────────────────

const [chiefOfStaff] = await db
  .insert(agents)
  .values({
    companyId: company!.id,
    name: "Chief of Staff",
    role: "ceo",
    title: "Chief of Staff",
    status: "idle",
    capabilities: "Cross-brand coordination, morning briefings, escalation routing. Full MCP access.",
    adapterType: "claude_local",
    adapterConfig: claudeConfig({
      instructions: path.join(INSTRUCTIONS_DIR, "chief-of-staff.md"),
      promptTemplate: [
        "You are the Chief of Staff for Truwitz. This is your scheduled morning heartbeat.",
        "Check the status of all four brands (Truwitz, Luna Luxe, CIO Daily Brief, Texas Butchers)",
        "across social and lead gen, then post a concise briefing to #olympus-zeus.",
        "Be direct — what's working, what needs attention, recommended actions for today.",
      ].join(" "),
    }),
    runtimeConfig: {
      heartbeat: { enabled: true, intervalSec: 86400 },
    },
    budgetMonthlyCents: 20000,
  })
  .returning();

console.log("Created Chief of Staff:", chiefOfStaff!.id);

// ── Brands ────────────────────────────────────────────────────────────────────

const BRANDS = [
  { name: "Truwitz",          slug: "truwitz",          b2c: false },
  { name: "Luna Luxe",        slug: "luna-luxe",        b2c: false },
  { name: "CIO Daily Brief",  slug: "cio-daily-brief",  b2c: false },
  { name: "Texas Butchers",   slug: "texas-butchers",   b2c: true  },
] as const;

for (const brand of BRANDS) {
  // ── Brand Lead ──────────────────────────────────────────────────────────────

  const [lead] = await db
    .insert(agents)
    .values({
      companyId: company!.id,
      name: `${brand.name} Brand Lead`,
      role: "general",
      title: "Brand Lead",
      status: "idle",
      reportsTo: chiefOfStaff!.id,
      capabilities: `Owns all ${brand.name} activity. Monitors social calendar and lead gen pipeline. Delegates to ${brand.name} Social and Lead Gen agents.`,
      adapterType: "claude_local",
      adapterConfig: claudeConfig({
        instructions: path.join(INSTRUCTIONS_DIR, "brand-lead.md"),
        promptTemplate: `You are the Brand Lead for ${brand.name}. This is your scheduled heartbeat. Check social calendar status and lead gen pipeline for ${brand.name}, identify top actions needed today, and post a brief status to #olympus-zeus.`,
        env: { BRAND: brand.name },
      }),
      runtimeConfig: {
        heartbeat: { enabled: true, intervalSec: 86400 },
      },
      budgetMonthlyCents: 10000,
    })
    .returning();

  console.log(`Created ${brand.name} Brand Lead:`, lead!.id);

  // ── Social Agent ────────────────────────────────────────────────────────────

  const [social] = await db
    .insert(agents)
    .values({
      companyId: company!.id,
      name: `${brand.name} Social Agent`,
      role: "cmo",
      title: "Social Agent",
      status: "idle",
      reportsTo: lead!.id,
      capabilities: `Manages social media for ${brand.name}: content calendar, scheduling, engagement, comment replies. Posts to #olympus-hermes.`,
      adapterType: "claude_local",
      adapterConfig: claudeConfig({
        instructions: path.join(INSTRUCTIONS_DIR, "social-agent.md"),
        promptTemplate: `You are the Social Agent for ${brand.name}. This is your scheduled heartbeat. Check the content calendar, schedule any due posts, review engagement, reply to comments if needed, then post a status to #olympus-hermes.`,
        env: { BRAND: brand.name },
      }),
      runtimeConfig: {
        heartbeat: { enabled: true, intervalSec: 86400 },
      },
      budgetMonthlyCents: 10000,
    })
    .returning();

  console.log(`Created ${brand.name} Social Agent:`, social!.id);

  // ── Lead Gen Agent ──────────────────────────────────────────────────────────

  const pipelineType = brand.b2c
    ? "B2C — scraping pipeline (Instagram/Yelp → enrich → Lemlist). Note: scraping MCP not yet available."
    : "B2B — Apollo prospecting → Clay enrichment → Lemlist outreach.";

  const [leadGen] = await db
    .insert(agents)
    .values({
      companyId: company!.id,
      name: `${brand.name} Lead Gen Agent`,
      role: "researcher",
      title: "Lead Gen Agent",
      status: "idle",
      reportsTo: lead!.id,
      capabilities: `Manages lead generation for ${brand.name}. ${pipelineType} Posts to #olympus-artemis.`,
      adapterType: "claude_local",
      adapterConfig: claudeConfig({
        instructions: path.join(INSTRUCTIONS_DIR, "lead-gen-agent.md"),
        promptTemplate: `You are the Lead Gen Agent for ${brand.name}. This is your scheduled heartbeat. Pipeline type: ${pipelineType} Review active campaigns, source new leads if needed, push to enrichment, load into campaigns, then post a status to #olympus-artemis.`,
        env: {
          BRAND: brand.name,
          PIPELINE_TYPE: pipelineType,
        },
      }),
      runtimeConfig: {
        heartbeat: { enabled: true, intervalSec: 259200 }, // ~Mon/Wed/Fri
      },
      budgetMonthlyCents: 10000,
    })
    .returning();

  console.log(`Created ${brand.name} Lead Gen Agent:`, leadGen!.id);
}

// ── Ops Agent (Cerberus) ──────────────────────────────────────────────────────

await db.insert(agents).values({
  companyId: company!.id,
  name: "Ops Agent",
  role: "devops",
  title: "Ops Agent",
  status: "idle",
  reportsTo: chiefOfStaff!.id,
  capabilities: "Monitors Claw service health, MCP servers, error logs. Triggers restarts. Posts to #olympus-cerberus only when something needs attention.",
  adapterType: "claude_local",
  adapterConfig: claudeConfig({
    instructions: path.join(INSTRUCTIONS_DIR, "ops-agent.md"),
    promptTemplate: "You are the Ops Agent (Cerberus). Run a health check: check claw status, MCP server health, and recent errors. If anything is degraded, restart it and post to #olympus-cerberus. If everything is healthy, do nothing.",
  }),
  runtimeConfig: {
    heartbeat: { enabled: true, intervalSec: 900 }, // every 15 min
  },
  budgetMonthlyCents: 5000,
});

console.log("Created Ops Agent");

// ── Dev Agent (Prometheus) ────────────────────────────────────────────────────

await db.insert(agents).values({
  companyId: company!.id,
  name: "Dev Agent",
  role: "engineer",
  title: "Dev Agent",
  status: "idle",
  reportsTo: chiefOfStaff!.id,
  capabilities: "Software development for all Truwitz repos. Claude Code backed. Jira + Slack intake. Posts to #olympus-prometheus.",
  adapterType: "claude_local",
  adapterConfig: {
    command: "claude",
    cwd: CLAW_ROOT,
    dangerouslySkipPermissions: true,
    maxTurnsPerRun: 50,
    promptTemplate: "You are the Dev Agent (Prometheus) for Truwitz. Check for new Jira tickets or Slack requests assigned to you, plan and implement changes, create PRs, and report status to #olympus-prometheus.",
  },
  runtimeConfig: {
    heartbeat: { enabled: false, intervalSec: 0 }, // event-driven only
  },
  budgetMonthlyCents: 30000,
});

console.log("Created Dev Agent");

// ── Trading Agent (Poseidon) ──────────────────────────────────────────────────
// Trading is managed entirely by claw's trading module. Paperclip entry exists
// for visibility/budget tracking only — heartbeat is disabled.

await db.insert(agents).values({
  companyId: company!.id,
  name: "Trading Agent",
  role: "general",
  title: "Trading Agent",
  status: "idle",
  reportsTo: chiefOfStaff!.id,
  capabilities: "Truwitz internal trading — TopstepX NQ futures. Managed by claw trading module. Posts to #olympus-poseidon. Never visible to client brand agents.",
  adapterType: "process",
  adapterConfig: {
    command: "echo",
    args: ["Trading managed by claw trading module directly"],
  },
  runtimeConfig: {
    heartbeat: { enabled: false, intervalSec: 0 },
  },
  budgetMonthlyCents: 5000,
});

console.log("Created Trading Agent");

console.log(`\n✓ Truwitz seeded successfully`);
console.log(`  Company ID: ${company!.id}`);
console.log(`  Agents: 16 total`);
console.log(`  - 1 Chief of Staff`);
console.log(`  - 4 Brand Leads (Truwitz, Luna Luxe, CIO Daily Brief, Texas Butchers)`);
console.log(`  - 4 Social Agents`);
console.log(`  - 4 Lead Gen Agents`);
console.log(`  - 1 Ops Agent`);
console.log(`  - 1 Dev Agent`);
console.log(`  - 1 Trading Agent`);
process.exit(0);
