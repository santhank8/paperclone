#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const bootstrapReportPath = path.resolve(repoRoot, "report/content-marketing-company-bootstrap.json");
const smokeReportPath = path.resolve(repoRoot, "report/content-marketing-company-smoke.json");
const manifestPath = path.resolve(repoRoot, "bootstrap/content-marketing-company/manifest.json");
const baseUrl = new URL(`${(process.env.PAPERCLIP_BASE_URL ?? "http://127.0.0.1:3100/api").replace(/\/+$/, "")}/`);

const bootstrap = JSON.parse(await fs.readFile(bootstrapReportPath, "utf8"));
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
const companyId = bootstrap.refs.companyId;
const automationStage = (process.env.PAPERCLIP_AUTOMATION_STAGE ?? manifest.automation?.defaultStage ?? "pilot").trim();

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

async function getAgent(agentId) {
  return api(`/agents/${agentId}`);
}

async function testEnvironment(type, adapterConfig) {
  return api(`/companies/${companyId}/adapters/${type}/test-environment`, {
    method: "POST",
    body: { adapterConfig },
  });
}

async function invokeHeartbeat(agentId) {
  return api(`/agents/${agentId}/heartbeat/invoke`, {
    method: "POST",
    body: {},
  });
}

async function getRun(runId) {
  return api(`/heartbeat-runs/${runId}`);
}

async function listIssueComments(issueId) {
  return api(`/issues/${issueId}/comments`);
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForRun(runId, timeoutMs = 180000) {
  const start = Date.now();
  const terminalStatuses = new Set(["completed", "succeeded", "failed", "cancelled", "error"]);
  while (Date.now() - start < timeoutMs) {
    const run = await getRun(runId);
    if (terminalStatuses.has(run.status)) return run;
    await sleep(3000);
  }
  return getRun(runId);
}

async function main() {
  const ceo = await getAgent(bootstrap.refs.agentIds.ceo);
  const ops = await getAgent(bootstrap.refs.agentIds.ops);
  const growth = await getAgent(bootstrap.refs.agentIds.growth);

  const adapterTests = {};
  adapterTests[ceo.adapterType] = await testEnvironment(ceo.adapterType, ceo.adapterConfig);
  if (!adapterTests[ops.adapterType]) {
    adapterTests[ops.adapterType] = await testEnvironment(ops.adapterType, ops.adapterConfig);
  }
  if (!adapterTests[growth.adapterType]) {
    adapterTests[growth.adapterType] = await testEnvironment(growth.adapterType, growth.adapterConfig);
  }
  if (!adapterTests.gemini_local && manifest.geminiLocal?.enabled && (bootstrap.refs.secretIds.GEMINI_API_KEY || bootstrap.refs.secretIds.GOOGLE_API_KEY)) {
    const geminiSecretId = bootstrap.refs.secretIds.GEMINI_API_KEY ?? bootstrap.refs.secretIds.GOOGLE_API_KEY;
    adapterTests.gemini_local = await testEnvironment("gemini_local", {
      command: manifest.geminiLocal.command ?? "gemini",
      cwd: path.resolve(bootstrap.refs.workspaceRoot, manifest.geminiLocal.cwd ?? "research"),
      model: manifest.geminiLocal.model ?? "auto",
      env: {
        GEMINI_API_KEY: {
          type: "secret_ref",
          secretId: geminiSecretId,
          version: "latest",
        },
      },
    });
  }

  const targetRuns = automationStage === "pilot"
    ? [
      { agentKey: "ops", issueKey: "ops-control-loop" },
      { agentKey: "growth", issueKey: "distribution-stack" },
      { agentKey: "analytics", issueKey: "analytics-loop" },
    ]
    : [
      { agentKey: "ceo", issueKey: "ceo-strategy" },
      { agentKey: "ops", issueKey: "ops-control-loop" },
      { agentKey: "writer", issueKey: "content-calendar" },
      { agentKey: "growth", issueKey: "distribution-stack" },
    ];
  if (automationStage === "steady") {
    targetRuns.push(
      { agentKey: "research", issueKey: "icp-brief" },
      { agentKey: "editor", issueKey: "editorial-sop" },
      { agentKey: "analytics", issueKey: "analytics-loop" },
    );
  }

  const queuedRuns = [];
  for (const target of targetRuns) {
    const run = await invokeHeartbeat(bootstrap.refs.agentIds[target.agentKey]);
    queuedRuns.push({ ...target, runId: run.id, initialStatus: run.status });
  }

  const completedRuns = [];
  for (const run of queuedRuns) {
    const finalRun = await waitForRun(run.runId);
    const comments = await listIssueComments(bootstrap.refs.issueIds[run.issueKey]);
    completedRuns.push({
      ...run,
      finalStatus: finalRun.status,
      error: finalRun.error ?? null,
      issueCommentCount: comments.length,
      lastCommentPreview:
        comments.length > 0
          ? String(comments.at(-1).body ?? "").slice(0, 280)
          : null,
    });
  }

  const companyCostSummary = await api(`/companies/${companyId}/costs/summary`);
  const agentCostSummary = await api(`/companies/${companyId}/costs/by-agent`);

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: baseUrl.toString(),
    automationStage,
    adapterTests,
    completedRuns,
    companyCostSummary,
    agentCostSummary,
  };

  await fs.writeFile(smokeReportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
