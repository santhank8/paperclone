#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const bootstrapReportPath = path.resolve(repoRoot, "report/content-marketing-company-bootstrap.json");
const manifestPath = path.resolve(repoRoot, "bootstrap/content-marketing-company/manifest.json");
const baseUrl = new URL(`${(process.env.PAPERCLIP_BASE_URL ?? "http://127.0.0.1:3100/api").replace(/\/+$/, "")}/`);

const bootstrap = JSON.parse(await fs.readFile(bootstrapReportPath, "utf8"));
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
const stageFlagIndex = process.argv.findIndex((arg) => arg === "--stage");
const stageFromFlag = stageFlagIndex >= 0 ? process.argv[stageFlagIndex + 1] : null;
const stageFromEqualsFlag = process.argv.find((arg) => arg.startsWith("--stage="))?.split("=", 2)[1] ?? null;
const requestedStage = (
  process.env.PAPERCLIP_AUTOMATION_STAGE
  ?? stageFromFlag
  ?? stageFromEqualsFlag
  ?? process.argv[2]
  ?? manifest.automation?.defaultStage
  ?? "pilot"
).trim();
const stageConfig = manifest.automation?.stages?.[requestedStage];
if (!stageConfig) {
  throw new Error(`Unknown automation stage "${requestedStage}". Available stages: ${Object.keys(manifest.automation?.stages ?? {}).join(", ")}`);
}
const enabledAgentKeys = new Set(Array.isArray(stageConfig.enabledAgentKeys) ? stageConfig.enabledAgentKeys : []);

async function api(pathname, options = {}) {
  const url = new URL(pathname.replace(/^\//, ""), baseUrl);
  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${options.method ?? "GET"} ${url} failed (${response.status}): ${text}`);
  }
  return json;
}

async function main() {
  const results = [];
  for (const agentSpec of manifest.agents) {
    const agentId = bootstrap.refs.agentIds[agentSpec.key];
    const updated = await api(`/agents/${agentId}`, {
      method: "PATCH",
      body: {
        runtimeConfig: {
          heartbeat: {
            ...agentSpec.runtimeConfig.heartbeat,
            enabled: enabledAgentKeys.has(agentSpec.key),
          },
        },
      },
    });
    results.push({
      key: agentSpec.key,
      id: agentId,
      heartbeat: updated.runtimeConfig?.heartbeat ?? null,
    });
  }
  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), stage: requestedStage, results }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
