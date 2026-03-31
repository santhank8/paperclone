import type {
  AdapterSkillContext,
  AdapterSkillSnapshot,
} from "@paperclipai/adapter-utils";
import {
  readPaperclipRuntimeSkillEntries,
  resolvePaperclipDesiredSkillNames,
} from "@paperclipai/adapter-utils/server-utils";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { promises as fs } from "node:fs";

const __moduleDir = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// readDesiredSkillContent
// ---------------------------------------------------------------------------
// Reads the Paperclip-managed skills from config.paperclipRuntimeSkills and
// returns an array of { name, content } objects.  DeerFlow does NOT install
// skills to the filesystem — they are injected into the LangGraph run context
// so the Python side can consume them directly.
// ---------------------------------------------------------------------------

export interface DesiredSkillContent {
  name: string;
  content: string;
}

export async function readDesiredSkillContent(
  config: Record<string, unknown>,
): Promise<DesiredSkillContent[]> {
  const availableEntries = await readPaperclipRuntimeSkillEntries(config, __moduleDir);
  const desiredKeys = resolvePaperclipDesiredSkillNames(config, availableEntries);
  if (desiredKeys.length === 0) return [];

  const desiredSet = new Set(desiredKeys);
  const results: DesiredSkillContent[] = [];

  for (const entry of availableEntries) {
    if (!desiredSet.has(entry.key)) continue;

    // Try to read the SKILL.md content from the source directory.
    let content = "";
    if (entry.source) {
      try {
        content = await fs.readFile(path.join(entry.source, "SKILL.md"), "utf8");
      } catch {
        // Skill directory may not have a SKILL.md — include with empty content
        // so the name is still passed through to the DeerFlow context.
      }
    }

    results.push({
      name: entry.runtimeName,
      content,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// listSkills / syncSkills
// ---------------------------------------------------------------------------
// DeerFlow skills are injected at runtime via the LangGraph run context, not
// installed to the filesystem.  listSkills returns the available/desired state
// and syncSkills is effectively a no-op that returns the current snapshot.
// ---------------------------------------------------------------------------

async function buildDeerFlowSkillSnapshot(
  config: Record<string, unknown>,
): Promise<AdapterSkillSnapshot> {
  const availableEntries = await readPaperclipRuntimeSkillEntries(config, __moduleDir);
  const desiredSkills = resolvePaperclipDesiredSkillNames(config, availableEntries);
  const desiredSet = new Set(desiredSkills);

  return {
    adapterType: "deerflow",
    supported: true,
    mode: "ephemeral",
    desiredSkills,
    entries: availableEntries.map((entry) => ({
      key: entry.key,
      runtimeName: entry.runtimeName,
      desired: desiredSet.has(entry.key),
      managed: true,
      state: desiredSet.has(entry.key) ? "configured" : "available",
      origin: entry.required ? "paperclip_required" : "company_managed",
      originLabel: entry.required ? "Required by Paperclip" : "Managed by Paperclip",
      readOnly: false,
      sourcePath: entry.source,
      targetPath: null,
      detail: desiredSet.has(entry.key)
        ? "Injected into DeerFlow run context at execution time."
        : null,
      required: Boolean(entry.required),
      requiredReason: entry.requiredReason ?? null,
    })),
    warnings: [],
  };
}

export async function listSkills(ctx: AdapterSkillContext): Promise<AdapterSkillSnapshot> {
  return buildDeerFlowSkillSnapshot(ctx.config);
}

export async function syncSkills(
  ctx: AdapterSkillContext,
  _desiredSkills: string[],
): Promise<AdapterSkillSnapshot> {
  // DeerFlow skills are injected at runtime — no filesystem sync needed.
  return buildDeerFlowSkillSnapshot(ctx.config);
}
