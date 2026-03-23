/**
 * Seed knowledge-gardener agent via Paperclip API
 * Run: pnpm tsx scripts/seed-knowledge-gardener.ts
 */

const API_BASE = process.env.PAPERCLIP_API_URL ?? "http://localhost:3100/api";
const EVOHAUS_COMPANY_ID = "e4f86ad5-bcdd-4ac9-9972-11ed5f6c7820";

async function main() {
  // Check if agent already exists
  const agentsRes = await fetch(`${API_BASE}/companies/${EVOHAUS_COMPANY_ID}/agents`);
  if (!agentsRes.ok) {
    console.error(`Failed to fetch agents: ${agentsRes.status}`);
    process.exit(1);
  }
  const existingAgents = await agentsRes.json() as any[];
  const existing = existingAgents.find((a: any) => a.name === "Knowledge Gardener");
  if (existing) {
    console.log(`Agent already exists: ${existing.id}`);
    process.exit(0);
  }

  // Create agent
  const createRes = await fetch(`${API_BASE}/companies/${EVOHAUS_COMPANY_ID}/agents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Knowledge Gardener",
      role: "analyst",
      title: "Bilgi Bakıcısı",
      icon: "🧹",
      adapterType: "claude_local",
      capabilities: "Knowledge dedup, prune, relevance decay, weekly digest, gap detection",
      runtimeConfig: {
        heartbeat: {
          every: "6h",
          activeHours: { start: "02:00", end: "06:00" },
        },
      },
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    console.error(`Failed to create agent: ${createRes.status} — ${err}`);
    process.exit(1);
  }

  const agent = await createRes.json() as any;
  console.log(`Created: ${agent.name} (${agent.id})`);

  // Set capability tags
  const updateRes = await fetch(`${API_BASE}/agents/${agent.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      capabilityTags: ["knowledge", "maintenance", "dedup", "prune", "digest", "analytics"],
      specialty: "Knowledge store maintenance and optimization",
    }),
  });

  if (updateRes.ok) {
    console.log("Capability tags set");
  }

  console.log("\nDone! Knowledge Gardener agent seeded.");
  console.log("AGENTS.md instructions should include:");
  console.log("- Dedup: title/body similarity > 0.92 → merge via POST /api/knowledge/:id/supersede");
  console.log("- Prune: relevance < 0.1 + accessCount=0 + 30+ days → soft delete");
  console.log("- Decay: POST /api/knowledge/decay (runs applyRelevanceDecay)");
  console.log("- Digest: GET /api/knowledge/weekly-digest → create summary issue for CEO");
}

main().catch(console.error);
