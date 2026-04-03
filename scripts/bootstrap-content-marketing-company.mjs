#!/usr/bin/env node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const manifestPath = path.resolve(repoRoot, "bootstrap/content-marketing-company/manifest.json");
const reportPath = path.resolve(repoRoot, "report/content-marketing-company-bootstrap.json");
const workspaceParent = path.resolve(repoRoot, "..");
const baseUrl = new URL(`${(process.env.PAPERCLIP_BASE_URL ?? "http://127.0.0.1:3100/api").replace(/\/+$/, "")}/`);

const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
const workspaceRoot = path.resolve(workspaceParent, manifest.workspaceRootName);

async function api(pathname, options = {}) {
  const url = new URL(pathname.replace(/^\//, ""), baseUrl);
  const headers = {
    Accept: "application/json",
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...(options.headers ?? {}),
  };
  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!response.ok) {
    let detail = "";
    try {
      detail = await response.text();
    } catch {
      detail = response.statusText;
    }
    throw new Error(`${options.method ?? "GET"} ${url} failed (${response.status}): ${detail}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
  for (const child of ["inbox", "notes", "outputs"]) {
    await fs.mkdir(path.join(dirPath, child), { recursive: true });
  }
}

async function ensureWorkspaceLayout() {
  await fs.mkdir(workspaceRoot, { recursive: true });
  for (const agent of manifest.agents) {
    await ensureDir(path.resolve(workspaceRoot, agent.cwd));
  }
}

function absoluteInstructionPath(relativePath) {
  return path.resolve(repoRoot, relativePath);
}

async function getOrCreateCompany() {
  const companies = await api("/companies");
  const existing = companies.find((company) => company.name === manifest.company.name);
  if (existing) {
    const updated = await api(`/companies/${existing.id}`, {
      method: "PATCH",
      body: {
        name: manifest.company.name,
        description: manifest.company.description,
        budgetMonthlyCents: manifest.company.budgetMonthlyCents,
        requireBoardApprovalForNewAgents: manifest.company.requireBoardApprovalForNewAgents,
        brandColor: manifest.company.brandColor,
      },
    });
    return updated;
  }
  return api("/companies", {
    method: "POST",
    body: {
      name: manifest.company.name,
      description: manifest.company.description,
      budgetMonthlyCents: manifest.company.budgetMonthlyCents,
      requireBoardApprovalForNewAgents: manifest.company.requireBoardApprovalForNewAgents,
      brandColor: manifest.company.brandColor,
    },
  });
}

async function ensureCompanySettings(companyId) {
  return api(`/companies/${companyId}`, {
    method: "PATCH",
    body: {
      description: manifest.company.description,
      budgetMonthlyCents: manifest.company.budgetMonthlyCents,
      requireBoardApprovalForNewAgents: manifest.company.requireBoardApprovalForNewAgents,
      brandColor: manifest.company.brandColor,
    },
  });
}

async function ensureSecret(companyId, secretSpec) {
  const secrets = await api(`/companies/${companyId}/secrets`);
  const envValue = process.env[secretSpec.envVar];
  if (!envValue) {
    throw new Error(`Required environment variable is missing: ${secretSpec.envVar}`);
  }
  const existing = secrets.find((secret) => secret.name === secretSpec.name);
  if (existing) {
    await api(`/secrets/${existing.id}`, {
      method: "PATCH",
      body: {
        name: secretSpec.name,
        description: secretSpec.description,
      },
    });
    await api(`/secrets/${existing.id}/rotate`, {
      method: "POST",
      body: { value: envValue },
    });
    return existing.id;
  }
  const created = await api(`/companies/${companyId}/secrets`, {
    method: "POST",
    body: {
      name: secretSpec.name,
      value: envValue,
      description: secretSpec.description,
    },
  });
  return created.id;
}

async function ensureGoal(companyId, goalSpec, parentId = null, ownerAgentId = null) {
  const goals = await api(`/companies/${companyId}/goals`);
  const existing = goals.find((goal) => goal.title === goalSpec.title);
  const payload = {
    title: goalSpec.title,
    description: goalSpec.description,
    level: goalSpec.level,
    status: goalSpec.status,
    parentId,
    ownerAgentId,
  };
  if (existing) {
    return api(`/goals/${existing.id}`, { method: "PATCH", body: payload });
  }
  return api(`/companies/${companyId}/goals`, { method: "POST", body: payload });
}

async function ensureAgent(companyId, agentSpec, refs) {
  const agents = await api(`/companies/${companyId}/agents`);
  const existing = agents.find((agent) => agent.name === agentSpec.name);
  const secretEnv = {};
  if (agentSpec.adapterType === "claude_local" && agentSpec.authStrategy === "anthropic_api_key") {
    secretEnv.ANTHROPIC_API_KEY = { type: "secret_ref", secretId: refs.secretIds.ANTHROPIC_API_KEY, version: "latest" };
  }
  if (agentSpec.adapterType === "claude_local" && agentSpec.authStrategy === "cli_login") {
    secretEnv.ANTHROPIC_API_KEY = "";
  }
  if (agentSpec.adapterType === "codex_local" && agentSpec.authStrategy === "api_key") {
    secretEnv.OPENAI_API_KEY = { type: "secret_ref", secretId: refs.secretIds.OPENAI_API_KEY, version: "latest" };
  }
  if (agentSpec.adapterType === "codex_local" && agentSpec.authStrategy === "chatgpt_login") {
    secretEnv.OPENAI_API_KEY = "";
    secretEnv.OPENROUTER_API_KEY = "";
    secretEnv.OPENAI_BASE_URL = "";
    secretEnv.CODEX_HOME = path.resolve(os.homedir(), ".codex");
  }
  if (agentSpec.adapterType === "gemini_local") {
    const preferredGeminiSecretId = refs.secretIds.GEMINI_API_KEY ?? refs.secretIds.GOOGLE_API_KEY ?? null;
    if (preferredGeminiSecretId) {
      secretEnv.GEMINI_API_KEY = { type: "secret_ref", secretId: preferredGeminiSecretId, version: "latest" };
    }
  }

  const adapterConfig = {
    cwd: path.resolve(workspaceRoot, agentSpec.cwd),
    instructionsFilePath: absoluteInstructionPath(agentSpec.instructionsFile),
    env: secretEnv,
    ...(agentSpec.adapterConfig ?? {}),
    ...(agentSpec.adapterType === "claude_local" ? { dangerouslySkipPermissions: false } : {}),
  };

  const createPayload = {
    name: agentSpec.name,
    role: agentSpec.role,
    title: agentSpec.title,
    reportsTo: agentSpec.reportsTo ? refs.agentIds[agentSpec.reportsTo] : null,
    capabilities: agentSpec.capabilities,
    adapterType: agentSpec.adapterType,
    adapterConfig,
    runtimeConfig: agentSpec.runtimeConfig,
    budgetMonthlyCents: agentSpec.budgetMonthlyCents,
    permissions: {
      canCreateAgents: Boolean(agentSpec.permissions?.canCreateAgents),
    },
  };

  const updatePayload = {
    ...createPayload,
    replaceAdapterConfig: true,
  };
  delete updatePayload.permissions;

  const agent = existing
    ? await api(`/agents/${existing.id}`, { method: "PATCH", body: updatePayload })
    : await api(`/companies/${companyId}/agents`, { method: "POST", body: createPayload });

  if (agentSpec.permissions) {
    await api(`/agents/${agent.id}/permissions`, {
      method: "PATCH",
      body: {
        canCreateAgents: Boolean(agentSpec.permissions.canCreateAgents),
        canAssignTasks: Boolean(agentSpec.permissions.canAssignTasks),
      },
    });
  }

  return agent;
}

async function ensureProject(companyId, projectSpec, refs) {
  const projects = await api(`/companies/${companyId}/projects`);
  const existing = projects.find((project) => project.name === projectSpec.name);
  const payload = {
    name: projectSpec.name,
    description: projectSpec.description,
    status: "planned",
    leadAgentId: refs.agentIds[projectSpec.leadAgent],
    goalIds: [refs.goalIds[projectSpec.key]],
    color: projectSpec.color,
    workspace: {
      name: `${projectSpec.name} Workspace`,
      sourceType: "local_path",
      cwd: path.resolve(workspaceRoot, projectSpec.workspaceCwd),
      isPrimary: true,
    },
  };
  return existing
    ? api(`/projects/${existing.id}?companyId=${encodeURIComponent(companyId)}`, { method: "PATCH", body: payload })
    : api(`/companies/${companyId}/projects`, { method: "POST", body: payload });
}

async function ensureIssue(companyId, issueSpec, refs) {
  const issues = await api(`/companies/${companyId}/issues`);
  const existing = issues.find((issue) => issue.title === issueSpec.title);
  const payload = {
    title: issueSpec.title,
    description: issueSpec.description,
    priority: issueSpec.priority,
    status: issueSpec.status,
    assigneeAgentId: refs.agentIds[issueSpec.assigneeAgent],
    projectId: issueSpec.projectKey ? refs.projectIds[issueSpec.projectKey] : null,
    goalId: issueSpec.goalKey ? refs.goalIds[issueSpec.goalKey] : refs.companyGoalId,
  };
  return existing
    ? api(`/issues/${existing.id}`, { method: "PATCH", body: payload })
    : api(`/companies/${companyId}/issues`, { method: "POST", body: payload });
}

async function ensureApproval(companyId, approvalSpec, refs) {
  const approvals = await api(`/companies/${companyId}/approvals?status=pending`);
  const existing = approvals.find((approval) =>
    approval.type === approvalSpec.type
    && approval.requestedByAgentId === refs.agentIds[approvalSpec.requestedByAgent],
  );
  if (existing) return existing;
  return api(`/companies/${companyId}/approvals`, {
    method: "POST",
    body: {
      type: approvalSpec.type,
      requestedByAgentId: refs.agentIds[approvalSpec.requestedByAgent],
      issueIds: [refs.issueIds[approvalSpec.issueKey]],
      payload: approvalSpec.payload,
    },
  });
}

async function writeReport(report) {
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
}

async function main() {
  await ensureWorkspaceLayout();

  const company = await getOrCreateCompany();
  await ensureCompanySettings(company.id);

  const refs = {
    companyId: company.id,
    companyGoalId: null,
    secretIds: {},
    agentIds: {},
    goalIds: {},
    projectIds: {},
    issueIds: {},
    approvalIds: {},
    workspaceRoot,
  };

  for (const secretSpec of manifest.secrets) {
    refs.secretIds[secretSpec.name] = await ensureSecret(company.id, secretSpec);
  }

  const companyGoal = await ensureGoal(company.id, manifest.goal, null, null);
  refs.companyGoalId = companyGoal.id;

  for (const agentSpec of manifest.agents) {
    if (agentSpec.reportsTo && !refs.agentIds[agentSpec.reportsTo]) continue;
    const agent = await ensureAgent(company.id, agentSpec, refs);
    refs.agentIds[agentSpec.key] = agent.id;
  }

  for (const agentSpec of manifest.agents) {
    if (refs.agentIds[agentSpec.key]) continue;
    const agent = await ensureAgent(company.id, agentSpec, refs);
    refs.agentIds[agentSpec.key] = agent.id;
  }

  for (const projectSpec of manifest.projects) {
    const goal = await ensureGoal(
      company.id,
      projectSpec.goal,
      refs.companyGoalId,
      refs.agentIds[projectSpec.leadAgent],
    );
    refs.goalIds[projectSpec.key] = goal.id;
  }

  for (const projectSpec of manifest.projects) {
    const project = await ensureProject(company.id, projectSpec, refs);
    refs.projectIds[projectSpec.key] = project.id;
  }

  for (const issueSpec of manifest.issues) {
    const issue = await ensureIssue(company.id, issueSpec, refs);
    refs.issueIds[issueSpec.key] = issue.id;
  }

  for (const approvalSpec of manifest.approvals) {
    const approval = await ensureApproval(company.id, approvalSpec, refs);
    refs.approvalIds[approvalSpec.key] = approval.id;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: baseUrl.toString(),
    company,
    automation: manifest.automation ?? null,
    governance: manifest.automation?.governance ?? null,
    refs,
  };
  await writeReport(report);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
