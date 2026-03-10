import { Command } from "commander";
import {
  createProjectSchema,
  updateProjectSchema,
  type Project,
} from "@paperclipai/shared";
import {
  addCommonClientOptions,
  formatInlineRecord,
  handleCommandError,
  printOutput,
  resolveCommandContext,
  type BaseClientOptions,
} from "./common.js";

interface ProjectListOptions extends BaseClientOptions {
  companyId?: string;
  status?: string;
  leadAgentId?: string;
  goalId?: string;
  match?: string;
}

interface ProjectCreateOptions extends BaseClientOptions {
  companyId?: string;
  name: string;
  description?: string;
  status?: string;
  leadAgentId?: string;
  targetDate?: string;
  color?: string;
  goalId?: string;
  goalIds?: string;
  workspaceName?: string;
  workspaceCwd?: string;
  workspaceRepoUrl?: string;
  workspaceRepoRef?: string;
  workspacePrimary?: boolean;
}

interface ProjectUpdateOptions extends BaseClientOptions {
  companyId?: string;
  name?: string;
  description?: string;
  status?: string;
  leadAgentId?: string;
  targetDate?: string;
  color?: string;
  goalId?: string;
  goalIds?: string;
  archivedAt?: string;
}

function parseCsv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function resolveGoalIds(input: { goalId?: string; goalIds?: string }): string[] | undefined {
  if (input.goalIds !== undefined) return parseCsv(input.goalIds);
  if (input.goalId === undefined) return undefined;
  const single = input.goalId.trim();
  return single ? [single] : [];
}

function parseArchivedAt(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value.trim().toLowerCase() === "null") return null;
  return value;
}

function buildProjectPath(idOrRef: string, companyId?: string): string {
  const query = companyId?.trim() ? `?companyId=${encodeURIComponent(companyId.trim())}` : "";
  return `/api/projects/${encodeURIComponent(idOrRef)}${query}`;
}

function buildWorkspaceInput(opts: ProjectCreateOptions) {
  const hasWorkspaceInput = Boolean(
    opts.workspaceName ||
      opts.workspaceCwd ||
      opts.workspaceRepoUrl ||
      opts.workspaceRepoRef ||
      opts.workspacePrimary,
  );
  if (!hasWorkspaceInput) return undefined;

  return {
    name: opts.workspaceName,
    cwd: opts.workspaceCwd,
    repoUrl: opts.workspaceRepoUrl,
    repoRef: opts.workspaceRepoRef,
    isPrimary: opts.workspacePrimary,
  };
}

function primaryWorkspaceLabel(project: Project): string | null {
  const workspace = project.primaryWorkspace;
  if (!workspace) return null;
  return workspace.cwd ?? workspace.repoUrl ?? workspace.name;
}

export function filterProjectRows(rows: Project[], opts: ProjectListOptions): Project[] {
  const statusFilters = new Set(parseCsv(opts.status).map((value) => value.toLowerCase()));
  const goalIdFilter = opts.goalId?.trim();
  const leadAgentIdFilter = opts.leadAgentId?.trim();
  const needle = opts.match?.trim().toLowerCase();

  return rows.filter((row) => {
    if (statusFilters.size > 0 && !statusFilters.has(row.status.toLowerCase())) {
      return false;
    }

    if (leadAgentIdFilter && row.leadAgentId !== leadAgentIdFilter) {
      return false;
    }

    if (goalIdFilter) {
      const goalIds = row.goalIds ?? [];
      const legacyGoalId = row.goalId ? [row.goalId] : [];
      if (![...goalIds, ...legacyGoalId].includes(goalIdFilter)) {
        return false;
      }
    }

    if (!needle) return true;

    const haystack = [
      row.id,
      row.urlKey,
      row.name,
      row.description,
      row.status,
      row.color,
      row.primaryWorkspace?.name,
      row.primaryWorkspace?.cwd,
      row.primaryWorkspace?.repoUrl,
    ]
      .filter((part): part is string => Boolean(part))
      .join("\n")
      .toLowerCase();

    return haystack.includes(needle);
  });
}

export function registerProjectCommands(program: Command): void {
  const project = program.command("project").description("Project operations");

  addCommonClientOptions(
    project
      .command("list")
      .description("List projects for a company")
      .requiredOption("-C, --company-id <id>", "Company ID")
      .option("--status <csv>", "Comma-separated statuses")
      .option("--lead-agent-id <id>", "Filter by lead agent ID")
      .option("--goal-id <id>", "Filter by goal ID")
      .option("--match <text>", "Local text match on id/url-key/name/description/workspace")
      .action(async (opts: ProjectListOptions) => {
        try {
          const ctx = resolveCommandContext(opts, { requireCompany: true });
          const rows = (await ctx.api.get<Project[]>(`/api/companies/${ctx.companyId}/projects`)) ?? [];
          const filtered = filterProjectRows(rows, opts);

          if (ctx.json) {
            printOutput(filtered, { json: true });
            return;
          }

          if (filtered.length === 0) {
            printOutput([], { json: false });
            return;
          }

          for (const row of filtered) {
            console.log(
              formatInlineRecord({
                id: row.id,
                urlKey: row.urlKey,
                status: row.status,
                name: row.name,
                leadAgentId: row.leadAgentId,
                goalCount: row.goalIds.length,
                primaryWorkspace: primaryWorkspaceLabel(row),
              }),
            );
          }
        } catch (err) {
          handleCommandError(err);
        }
      }),
    { includeCompany: false },
  );

  addCommonClientOptions(
    project
      .command("get")
      .description("Get a project by UUID or shortname/url-key")
      .argument("<idOrReference>", "Project ID or shortname/url-key")
      .action(async (idOrReference: string, opts: BaseClientOptions) => {
        try {
          const ctx = resolveCommandContext(opts);
          const row = await ctx.api.get<Project>(buildProjectPath(idOrReference, ctx.companyId));
          printOutput(row, { json: ctx.json });
        } catch (err) {
          handleCommandError(err);
        }
      }),
    { includeCompany: true },
  );

  addCommonClientOptions(
    project
      .command("create")
      .description("Create a project")
      .requiredOption("-C, --company-id <id>", "Company ID")
      .requiredOption("--name <name>", "Project name")
      .option("--description <text>", "Project description")
      .option("--status <status>", "Project status")
      .option("--lead-agent-id <id>", "Lead agent ID")
      .option("--target-date <date>", "Target date")
      .option("--color <color>", "Project color hex")
      .option("--goal-id <id>", "Single goal ID (legacy shorthand)")
      .option("--goal-ids <csv>", "Comma-separated goal IDs")
      .option("--workspace-name <name>", "Optional primary workspace display name")
      .option("--workspace-cwd <path>", "Optional primary workspace local path")
      .option("--workspace-repo-url <url>", "Optional primary workspace repo URL")
      .option("--workspace-repo-ref <ref>", "Optional primary workspace repo ref")
      .option("--workspace-primary", "Mark the created workspace as primary")
      .action(async (opts: ProjectCreateOptions) => {
        try {
          const ctx = resolveCommandContext(opts, { requireCompany: true });
          const payload = createProjectSchema.parse({
            name: opts.name,
            description: opts.description,
            status: opts.status,
            leadAgentId: opts.leadAgentId,
            targetDate: opts.targetDate,
            color: opts.color,
            goalIds: resolveGoalIds(opts),
            workspace: buildWorkspaceInput(opts),
          });

          const created = await ctx.api.post<Project>(`/api/companies/${ctx.companyId}/projects`, payload);
          printOutput(created, { json: ctx.json });
        } catch (err) {
          handleCommandError(err);
        }
      }),
    { includeCompany: false },
  );

  addCommonClientOptions(
    project
      .command("update")
      .description("Update a project")
      .argument("<idOrReference>", "Project ID or shortname/url-key")
      .option("--name <name>", "Project name")
      .option("--description <text>", "Project description")
      .option("--status <status>", "Project status")
      .option("--lead-agent-id <id>", "Lead agent ID")
      .option("--target-date <date>", "Target date")
      .option("--color <color>", "Project color hex")
      .option("--goal-id <id>", "Single goal ID (legacy shorthand)")
      .option("--goal-ids <csv>", "Comma-separated goal IDs")
      .option("--archived-at <iso8601|null>", "Set archivedAt timestamp or literal 'null'")
      .action(async (idOrReference: string, opts: ProjectUpdateOptions) => {
        try {
          const ctx = resolveCommandContext(opts);
          const payload = updateProjectSchema.parse({
            name: opts.name,
            description: opts.description,
            status: opts.status,
            leadAgentId: opts.leadAgentId,
            targetDate: opts.targetDate,
            color: opts.color,
            goalIds: resolveGoalIds(opts),
            archivedAt: parseArchivedAt(opts.archivedAt),
          });

          if (Object.keys(payload).length === 0) {
            throw new Error("At least one field is required to update a project.");
          }

          const updated = await ctx.api.patch<Project>(buildProjectPath(idOrReference, ctx.companyId), payload);
          printOutput(updated, { json: ctx.json });
        } catch (err) {
          handleCommandError(err);
        }
      }),
    { includeCompany: true },
  );
}
