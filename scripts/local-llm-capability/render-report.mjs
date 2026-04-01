#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const modelsPath = path.join(root, "docs/local-llm-capability/models.json");
const inPath = path.join(root, "docs/local-llm-capability/results.json");
const outPath = path.join(root, "docs/local-llm-capability/report.md");

const PASS_THRESHOLD = 0.8;

function pct(num, den) {
  return den === 0 ? "0%" : `${Math.round((num / den) * 100)}%`;
}

async function main() {
  const data = JSON.parse(await fs.readFile(inPath, "utf8"));
  const models = JSON.parse(await fs.readFile(modelsPath, "utf8"));
  const modelMeta = new Map(models.map((m) => [m.id, m]));

  const byModel = new Map();
  for (const row of data.rows) {
    const current = byModel.get(row.modelId) || { total: 0, pass: 0, totalLatency: 0 };
    current.total += 1;
    current.pass += row.pass ? 1 : 0;
    current.totalLatency += row.latencyMs || 0;
    byModel.set(row.modelId, current);
  }

  const entries = [...byModel.entries()].map(([modelId, agg]) => ({
    modelId,
    passRate: agg.total === 0 ? 0 : agg.pass / agg.total,
    avgLatency: Math.round(agg.totalLatency / agg.total),
    pass: agg.pass,
    total: agg.total,
    meta: modelMeta.get(modelId),
  }));

  const passing = entries.filter((e) => e.passRate >= PASS_THRESHOLD).sort((a, b) => b.passRate - a.passRate || a.avgLatency - b.avgLatency);
  const failing = entries.filter((e) => e.passRate < PASS_THRESHOLD).sort((a, b) => a.passRate - b.passRate);

  const lines = [
    "# Local LLM Capability Report",
    "",
    `Generated: ${data.generatedAt}`,
    "",
    "| Model | Pass Rate | Avg Latency (ms) |",
    "|---|---:|---:|",
  ];

  for (const e of entries) {
    lines.push(`| ${e.modelId} | ${pct(e.pass, e.total)} | ${e.avgLatency} |`);
  }

  // Top Passing Models
  lines.push("", "## Top Passing Models (<=8 GB)", "");
  if (passing.length === 0) {
    lines.push("No models met the >=80% pass-rate threshold.");
  } else {
    for (const e of passing) {
      lines.push(`- **${e.modelId}** — ${pct(e.pass, e.total)} pass rate, ${e.avgLatency}ms avg latency`);
    }
  }

  // Failed/Borderline Models
  lines.push("", "## Failed/Borderline Models", "");
  if (failing.length === 0) {
    lines.push("All models met the >=80% pass-rate threshold.");
  } else {
    for (const e of failing) {
      const reason = e.passRate === 0 ? "zero tool calls succeeded" : `only ${pct(e.pass, e.total)} pass rate`;
      lines.push(`- **${e.modelId}**: ${reason}`);
    }
  }

  // Runtime Notes
  const backends = [...new Set(entries.map((e) => e.meta?.backend).filter(Boolean))];
  const quantizations = [...new Set(entries.map((e) => {
    const match = e.modelId.match(/(q\d+_K_[A-Z]+|q\d+_\d+|fp16|bf16)/i);
    return match ? match[1] : "default";
  }))];
  lines.push(
    "",
    "## Runtime Notes",
    "",
    `- **Backend:** ${backends.join(", ") || "unknown"}`,
    `- **Quantizations tested:** ${quantizations.join(", ")}`,
    "- **Repro command:** \\`pnpm llm:research\\`",
  );

  await fs.writeFile(outPath, `${lines.join("\n")}\n`);
  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
