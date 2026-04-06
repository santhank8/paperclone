/**
 * Provisions managed, recurring automation for seeded virtual org companies.
 */
import { and, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { agents, projects, routineTriggers, routines } from "@paperclipai/db";
import {
  DEFAULT_CODEX_LOCAL_BYPASS_APPROVALS_AND_SANDBOX,
  DEFAULT_CODEX_LOCAL_MODEL,
} from "@paperclipai/adapter-codex-local";
import { agentInstructionsService } from "./agent-instructions.js";
import { agentService } from "./agents.js";
import { projectService } from "./projects.js";
import { resolveServerRepoRoot } from "./repo-root.js";
import { routineService } from "./routines.js";

const OFFICELY_KB_AGENT_NAME = "Officely Knowledge Base";
const OFFICELY_KB_AGENT_TITLE = "Knowledge Base Steward";
const OFFICELY_KB_AGENT_KEY = "officely-kb-agent";
const OFFICELY_KB_PROJECT_NAME = "Knowledge Base";
const OFFICELY_KB_PROJECT_DESCRIPTION =
  "Keeps the Officely company handbook fresh from saved snapshots and flags gaps for follow-up.";
const OFFICELY_KB_COMPILE_ROUTINE_TITLE = "Compile Officely knowledge base";
const OFFICELY_KB_LINT_ROUTINE_TITLE = "Lint Officely knowledge base";
const OFFICELY_KB_COMPILE_TRIGGER_LABEL = "Daily morning compile";
const OFFICELY_KB_LINT_TRIGGER_LABEL = "Friday quality check";
const OFFICELY_KB_TIMEZONE = "Australia/Melbourne";
const OFFICELY_KB_COMPILE_CRON = "0 7 * * *";
const OFFICELY_KB_LINT_CRON = "0 16 * * 5";
const SYSTEM_USER_ID = "virtual-org";

type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return value as JsonRecord;
}

function buildOfficelyKnowledgeAgentInstructions() {
  return `# Officely Knowledge Base Agent

## Purpose

You keep the Officely company handbook up to date from the app's saved snapshots.

Think of this as keeping the company's operating binder current:
- the raw exports are the receipts
- the wiki pages are the clean summary pages
- open questions are the sticky notes for missing evidence

## Scope

Only read and write inside:
- \`.context/company-kb/companies/officely/\`

Never change product code, tests, or anything outside that folder.

## Primary Sources

Start from:
- \`.context/company-kb/companies/officely/raw/sources/app-db/latest-officely-sync-snapshot.json\`

You may also use older dated files in the same \`raw/sources/\` tree when they help explain change over time.

## Daily Compile Job

When asked to compile the knowledge base:
1. Read the latest snapshot.
2. Refresh the dated source summary in \`raw/sources/app-db/\`.
3. Update the wiki pages with the latest trustworthy facts.
4. Keep important numbers tied back to the snapshot they came from.
5. Add a short entry to \`wiki/log.md\` describing what changed.

Prioritize these pages:
- \`wiki/overview.md\`
- \`wiki/finance.md\`
- \`wiki/growth.md\`
- \`wiki/operations.md\`
- \`wiki/customers.md\`
- \`wiki/open-questions.md\`
- \`wiki/timeline.md\`
- \`wiki/log.md\`

## Weekly Lint Job

When asked to lint the knowledge base:
1. Look for contradictions across pages.
2. Check whether headline numbers match the latest snapshot.
3. Flag missing identity joins, stale claims, or empty sections.
4. Add clear follow-up items to \`wiki/open-questions.md\`.
5. Add a short result to \`wiki/log.md\`.

Do not hide data problems. Call them out plainly.

## Writing Rules

- Use plain English.
- Do not invent facts.
- If a field is missing, say it is missing.
- Preserve useful history instead of overwriting it blindly.
- Prefer short, decision-ready summaries over long notes.
`;
}

function buildCompileRoutineDescription() {
  return [
    "Read the latest Officely snapshot from .context/company-kb/companies/officely/raw/sources/app-db/latest-officely-sync-snapshot.json.",
    "Refresh the company handbook pages inside .context/company-kb/companies/officely/wiki/.",
    "Update the dated source summary in raw/sources/app-db/ when the new snapshot changes the story.",
    "Append one short note to wiki/log.md with what changed and why it matters.",
    "Do not edit product code or files outside .context/company-kb/companies/officely/.",
  ].join("\n");
}

function buildLintRoutineDescription() {
  return [
    "Review the Officely handbook for contradictions, stale numbers, weak evidence, and missing sections.",
    "Compare the wiki pages against .context/company-kb/companies/officely/raw/sources/app-db/latest-officely-sync-snapshot.json.",
    "Record any important gaps in wiki/open-questions.md and summarize the check in wiki/log.md.",
    "Do not rewrite healthy sections just for style.",
    "Do not edit product code or files outside .context/company-kb/companies/officely/.",
  ].join("\n");
}

function repoScopedKnowledgeBaseCwd() {
  return resolveServerRepoRoot();
}

async function ensureOfficelyKnowledgeAgent(db: Db, companyId: string) {
  const agentsSvc = agentService(db);
  const instructionsSvc = agentInstructionsService();
  const existingAgents = await agentsSvc.list(companyId, { includeTerminated: true });
  const managedAgent = existingAgents.find((agent) => {
    const metadata = asRecord(agent.metadata);
    return metadata.systemKey === OFFICELY_KB_AGENT_KEY;
  });
  const fallbackAgent = existingAgents.find((agent) => {
    const metadata = asRecord(agent.metadata);
    return agent.name === OFFICELY_KB_AGENT_NAME && metadata.systemKey !== OFFICELY_KB_AGENT_KEY;
  });
  const currentCandidate = managedAgent ?? fallbackAgent ?? null;
  const current = currentCandidate?.status === "terminated" ? null : currentCandidate;
  const baseAdapterConfig = {
    ...asRecord(currentCandidate?.adapterConfig),
    cwd: repoScopedKnowledgeBaseCwd(),
    model: typeof asRecord(currentCandidate?.adapterConfig).model === "string"
      ? asRecord(currentCandidate?.adapterConfig).model
      : DEFAULT_CODEX_LOCAL_MODEL,
    dangerouslyBypassApprovalsAndSandbox:
      typeof asRecord(currentCandidate?.adapterConfig).dangerouslyBypassApprovalsAndSandbox === "boolean"
        ? asRecord(currentCandidate?.adapterConfig).dangerouslyBypassApprovalsAndSandbox
        : DEFAULT_CODEX_LOCAL_BYPASS_APPROVALS_AND_SANDBOX,
  };
  const nextMetadata = {
    ...asRecord(currentCandidate?.metadata),
    managedBy: "virtual-org-bootstrap",
    systemKey: OFFICELY_KB_AGENT_KEY,
    scope: "company-kb",
  };

  let agent = current;
  if (!agent) {
    agent = await agentsSvc.create(companyId, {
      name: OFFICELY_KB_AGENT_NAME,
      role: "general",
      title: OFFICELY_KB_AGENT_TITLE,
      status: "idle",
      reportsTo: null,
      capabilities: "knowledge_base_maintenance",
      adapterType: "codex_local",
      adapterConfig: baseAdapterConfig,
      runtimeConfig: {},
      budgetMonthlyCents: 0,
      permissions: {},
      metadata: nextMetadata,
    });
  } else {
    agent = await agentsSvc.update(agent.id, {
      title: OFFICELY_KB_AGENT_TITLE,
      capabilities: "knowledge_base_maintenance",
      adapterType: "codex_local",
      adapterConfig: baseAdapterConfig,
      metadata: nextMetadata,
    }) ?? agent;
  }

  const materialized = await instructionsSvc.materializeManagedBundle(
    agent,
    { "AGENTS.md": buildOfficelyKnowledgeAgentInstructions() },
    {
      clearLegacyPromptTemplate: true,
      replaceExisting: true,
    },
  );
  return (await agentsSvc.update(agent.id, { adapterConfig: materialized.adapterConfig })) ?? agent;
}

async function ensureOfficelyKnowledgeProject(db: Db, companyId: string, leadAgentId: string) {
  const projectsSvc = projectService(db);
  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.companyId, companyId));
  const current = rows.find((project) => {
    return (
      project.leadAgentId === leadAgentId
      && project.description === OFFICELY_KB_PROJECT_DESCRIPTION
    );
  }) ?? null;

  if (!current) {
    return projectsSvc.create(companyId, {
      name: OFFICELY_KB_PROJECT_NAME,
      description: OFFICELY_KB_PROJECT_DESCRIPTION,
      status: "in_progress",
      leadAgentId,
    });
  }

  return (await projectsSvc.update(current.id, {
    description: OFFICELY_KB_PROJECT_DESCRIPTION,
    status: current.status === "backlog" ? "in_progress" : current.status,
    leadAgentId,
  })) ?? current;
}

async function ensureOfficelyRoutine(
  db: Db,
  input: {
    companyId: string;
    projectId: string;
    assigneeAgentId: string;
    title: string;
    description: string;
  },
) {
  const routinesSvc = routineService(db);
  const current = await db
    .select()
    .from(routines)
    .where(
      and(
        eq(routines.companyId, input.companyId),
        eq(routines.projectId, input.projectId),
        eq(routines.assigneeAgentId, input.assigneeAgentId),
        eq(routines.title, input.title),
      ),
    )
    .then((rows) => rows[0] ?? null);

  if (!current) {
    return routinesSvc.create(
      input.companyId,
      {
        projectId: input.projectId,
        title: input.title,
        description: input.description,
        assigneeAgentId: input.assigneeAgentId,
        priority: "medium",
        status: "active",
        concurrencyPolicy: "coalesce_if_active",
        catchUpPolicy: "skip_missed",
        variables: [],
      },
      { userId: SYSTEM_USER_ID },
    );
  }

  return (await routinesSvc.update(
    current.id,
    {
      projectId: input.projectId,
      description: input.description,
      assigneeAgentId: input.assigneeAgentId,
      priority: "medium",
      status: "active",
      concurrencyPolicy: "coalesce_if_active",
      catchUpPolicy: "skip_missed",
      variables: [],
    },
    { userId: SYSTEM_USER_ID },
  )) ?? current;
}

async function ensureOfficelyScheduleTrigger(
  db: Db,
  input: {
    companyId: string;
    routineId: string;
    label: string;
    cronExpression: string;
    timezone: string;
  },
) {
  const routinesSvc = routineService(db);
  const current = await db
    .select()
    .from(routineTriggers)
    .where(
      and(
        eq(routineTriggers.companyId, input.companyId),
        eq(routineTriggers.routineId, input.routineId),
        eq(routineTriggers.kind, "schedule"),
        eq(routineTriggers.label, input.label),
      ),
    )
    .then((rows) => rows[0] ?? null);

  if (!current) {
    return routinesSvc.createTrigger(
      input.routineId,
      {
        kind: "schedule",
        label: input.label,
        cronExpression: input.cronExpression,
        timezone: input.timezone,
        enabled: true,
      },
      { userId: SYSTEM_USER_ID },
    );
  }

  const trigger = await routinesSvc.updateTrigger(
    current.id,
    {
      label: input.label,
      cronExpression: input.cronExpression,
      timezone: input.timezone,
      enabled: true,
    },
    { userId: SYSTEM_USER_ID },
  );
  return {
    trigger: trigger ?? current,
    secretMaterial: null,
  };
}

export async function ensureOfficelyKnowledgeBaseAutomation(
  db: Db,
  input: { companyId: string },
) {
  const agent = await ensureOfficelyKnowledgeAgent(db, input.companyId);
  const project = await ensureOfficelyKnowledgeProject(db, input.companyId, agent.id);
  const compileRoutine = await ensureOfficelyRoutine(db, {
    companyId: input.companyId,
    projectId: project.id,
    assigneeAgentId: agent.id,
    title: OFFICELY_KB_COMPILE_ROUTINE_TITLE,
    description: buildCompileRoutineDescription(),
  });
  const lintRoutine = await ensureOfficelyRoutine(db, {
    companyId: input.companyId,
    projectId: project.id,
    assigneeAgentId: agent.id,
    title: OFFICELY_KB_LINT_ROUTINE_TITLE,
    description: buildLintRoutineDescription(),
  });

  await ensureOfficelyScheduleTrigger(db, {
    companyId: input.companyId,
    routineId: compileRoutine.id,
    label: OFFICELY_KB_COMPILE_TRIGGER_LABEL,
    cronExpression: OFFICELY_KB_COMPILE_CRON,
    timezone: OFFICELY_KB_TIMEZONE,
  });
  await ensureOfficelyScheduleTrigger(db, {
    companyId: input.companyId,
    routineId: lintRoutine.id,
    label: OFFICELY_KB_LINT_TRIGGER_LABEL,
    cronExpression: OFFICELY_KB_LINT_CRON,
    timezone: OFFICELY_KB_TIMEZONE,
  });

  return {
    agentId: agent.id,
    projectId: project.id,
    compileRoutineId: compileRoutine.id,
    lintRoutineId: lintRoutine.id,
  };
}
