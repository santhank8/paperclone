/**
 * SENTINEL Agent — Paperclip DB Registration
 *
 * Registers the SENTINEL infrastructure monitoring agent as a codex_local
 * adapter agent in the EVOHAUS AI company. Idempotent — safe to re-run.
 *
 * Run: npx tsx packages/db/src/seed-sentinel-agent.ts
 */

import { createDb } from "./client.js";
import { agents } from "./schema/index.js";
import { eq, and } from "drizzle-orm";

const url = process.env.DATABASE_URL!;
if (!url) throw new Error("DATABASE_URL is required");
const db = createDb(url);

const COMPANY_ID = "e4f86ad5-bcdd-4ac9-9972-11ed5f6c7820";

async function main() {
  console.log("SENTINEL Agent — Seeding started\n");

  // 1. Find COO (OPERASYON) to set reportsTo
  const [coo] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.companyId, COMPANY_ID), eq(agents.name, "OPERASYON")))
    .limit(1);

  if (!coo) {
    console.error("ERROR: OPERASYON (COO) agent not found. Run seed-all-evohaus-projects.ts first.");
    process.exit(1);
  }
  console.log(`  Found OPERASYON: ${coo.id}`);

  // 2. Check if SENTINEL already exists
  const [existing] = await db
    .select({ id: agents.id })
    .from(agents)
    .where(and(eq(agents.companyId, COMPANY_ID), eq(agents.name, "SENTINEL")))
    .limit(1);

  const agentData: typeof agents.$inferInsert = {
    companyId: COMPANY_ID,
    name: "SENTINEL",
    role: "ops_infra_monitor",
    title: "Infrastructure & Fleet Health Engineer",
    icon: "shield",
    status: "idle",
    adapterType: "codex_local",
    adapterConfig: {
      cwd: "/Users/evohaus/Desktop/Projects/paperclip/sentinel",
      instructionsFilePath:
        "/Users/evohaus/Desktop/Projects/paperclip/sentinel/SENTINEL-SOUL.md",
      model: "o4-mini",
      dangerouslyBypassApprovalsAndSandbox: true,
      promptTemplate: [
        "You are SENTINEL (agent {{agent.id}}). Perform your scheduled 30-minute health check:",
        "1. SSH to VPS (31.97.176.234) with: ssh -i ~/.ssh/id_ed25519_deploy root@31.97.176.234",
        "2. Run: free -h, docker ps -a, df -h, check GPS scraper gaps via psql",
        "3. Analyze results against your threshold tables in SENTINEL-SOUL.md",
        "4. POST findings to knowledge_store via $PAPERCLIP_API_URL/api/knowledge",
        "5. If CRITICAL: alert via $SENTINEL_WEBHOOK",
        "Be concise — routine heartbeat, not deep dive.",
      ].join("\n"),
      env: {
        SENTINEL_WEBHOOK:
          "https://nail.n8n.evohaus.org/webhook/sentinel-alert",
      },
      timeoutSec: 300,
      graceSec: 30,
    },
    runtimeConfig: {
      heartbeat: {
        enabled: true,
        intervalSec: 1800, // 30 minutes
        wakeOnDemand: true,
        maxConcurrentRuns: 1,
        model: "o4-mini",
      },
      skillAllowlist: {
        enabled: true,
        allowed: ["paperclip", "evohaus-monitor", "vps"],
        blocked: ["paperclip-create-agent", "paperclip-create-plugin"],
      },
    },
    capabilities:
      "vps-monitoring, fleet-health, scraper-sla, docker-health, thermal-monitoring, disk-space, memory-analysis, ssh-diagnostics",
    capabilityTags: [
      "infrastructure",
      "monitoring",
      "vps",
      "docker",
      "scraper-sla",
      "fleet-health",
      "diagnostics",
      "sentinel",
    ],
    specialty: "4-machine fleet monitoring: VPS, M4, M1, T570",
    reportsTo: coo.id,
    budgetMonthlyCents: 3000, // $30/month
    permissions: {
      ssh: true,
      shellExecution: true,
      knowledgeStoreWrite: true,
    },
    metadata: {
      level: "operational",
      domain: "infrastructure",
      machines: ["vps", "m4-mac-mini", "m1-mac-mini", "t570-thinkpad"],
      alertWebhook: "https://nail.n8n.evohaus.org/webhook/sentinel-alert",
      monitoringDomains: [
        "cpu",
        "memory",
        "disk",
        "network",
        "thermals",
        "processes",
        "services",
      ],
    },
  };

  if (existing) {
    // Update existing SENTINEL agent
    await db
      .update(agents)
      .set({
        ...agentData,
        // Don't overwrite status if agent is running
        status: undefined,
      })
      .where(eq(agents.id, existing.id));
    console.log(`  [UPDATED] SENTINEL (${existing.id})`);
  } else {
    // Insert new SENTINEL agent
    const [row] = await db
      .insert(agents)
      .values(agentData)
      .returning({ id: agents.id });
    console.log(`  [CREATED] SENTINEL (${row!.id})`);
  }

  console.log("\nSENTINEL Agent — Seeding complete");
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
