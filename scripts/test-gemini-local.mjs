#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const bootstrapReportPath = path.resolve(repoRoot, "report/content-marketing-company-bootstrap.json");
const manifestPath = path.resolve(repoRoot, "bootstrap/content-marketing-company/manifest.json");
const reportPath = path.resolve(repoRoot, "report/content-marketing-company-gemini-test.json");
const baseUrl = new URL(`${(process.env.PAPERCLIP_BASE_URL ?? "http://127.0.0.1:3100/api").replace(/\/+$/, "")}/`);

const bootstrap = JSON.parse(await fs.readFile(bootstrapReportPath, "utf8"));
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
const companyId = bootstrap.refs.companyId;

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
  if (!manifest.geminiLocal?.enabled) {
    throw new Error("manifest.geminiLocal.enabled is false");
  }
  const geminiSecretId = bootstrap.refs.secretIds.GEMINI_API_KEY ?? bootstrap.refs.secretIds.GOOGLE_API_KEY;
  if (!geminiSecretId) {
    throw new Error("Gemini secret is missing from bootstrap report");
  }

  const adapterConfig = {
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
  };

  const result = await api(`/companies/${companyId}/adapters/gemini_local/test-environment`, {
    method: "POST",
    body: { adapterConfig },
  });

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: baseUrl.toString(),
    companyId,
    adapterConfig: {
      command: adapterConfig.command,
      cwd: adapterConfig.cwd,
      model: adapterConfig.model,
      envKeys: Object.keys(adapterConfig.env),
    },
    result,
  };

  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
