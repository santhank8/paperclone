#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const inPath = path.join(root, "docs/local-llm-capability/results.json");
const outPath = path.join(root, "docs/local-llm-capability/report.md");

function pct(num, den) {
  return den === 0 ? "0%" : `${Math.round((num / den) * 100)}%`;
}

async function main() {
  const data = JSON.parse(await fs.readFile(inPath, "utf8"));
  const byModel = new Map();

  for (const row of data.rows) {
    const current = byModel.get(row.modelId) || { total: 0, pass: 0, avgLatency: 0 };
    current.total += 1;
    current.pass += row.pass ? 1 : 0;
    current.avgLatency += row.latencyMs || 0;
    byModel.set(row.modelId, current);
  }

  const lines = [
    "# Local LLM Capability Report",
    "",
    `Generated: ${data.generatedAt}`,
    "",
    "| Model | Pass Rate | Avg Latency (ms) |",
    "|---|---:|---:|",
  ];

  for (const [modelId, agg] of byModel.entries()) {
    const avgLatency = Math.round(agg.avgLatency / agg.total);
    lines.push(`| ${modelId} | ${pct(agg.pass, agg.total)} | ${avgLatency} |`);
  }

  lines.push("", "## Recommendation Rule", "", "Recommend models with >=80% pass rate and stable latency.");

  await fs.writeFile(outPath, `${lines.join("\n")}\n`);
  console.log(`Wrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
