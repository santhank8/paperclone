import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AdapterExecutionContext } from "@paperclipai/adapter-utils";

const DEFAULT_PAPERCLIP_INSTANCE_ID = "default";
const COPIED_SHARED_FILES = [".credentials.json", "credentials.json"] as const;
const PRUNED_CONFIG_ENTRIES = ["settings.local.json", "agents", "commands", "plugins"] as const;

function nonEmpty(value: string | undefined): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isWorktreeMode(env: NodeJS.ProcessEnv): boolean {
  return /^(1|true|yes|on)$/i.test(env.PAPERCLIP_IN_WORKTREE ?? "");
}

export async function pathExists(candidate: string): Promise<boolean> {
  return fs.access(candidate).then(() => true).catch(() => false);
}

export function resolveSharedClaudeConfigDir(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const explicitConfigDir = nonEmpty(env.CLAUDE_CONFIG_DIR);
  if (explicitConfigDir) return path.resolve(explicitConfigDir);
  const home = nonEmpty(env.HOME) ?? os.homedir();
  return path.resolve(home, ".claude");
}

export function resolveManagedClaudeHomeDir(
  env: NodeJS.ProcessEnv,
  companyId?: string,
  agentId?: string,
): string {
  const paperclipHome = nonEmpty(env.PAPERCLIP_HOME) ?? path.resolve(os.homedir(), ".paperclip");
  const instanceId = nonEmpty(env.PAPERCLIP_INSTANCE_ID) ?? DEFAULT_PAPERCLIP_INSTANCE_ID;
  if (companyId && agentId) {
    return path.resolve(
      paperclipHome,
      "instances",
      instanceId,
      "companies",
      companyId,
      "agents",
      agentId,
      "claude-home",
    );
  }
  if (companyId) {
    return path.resolve(
      paperclipHome,
      "instances",
      instanceId,
      "companies",
      companyId,
      "claude-home",
    );
  }
  return path.resolve(paperclipHome, "instances", instanceId, "claude-home");
}

export function resolveManagedClaudeConfigDir(
  env: NodeJS.ProcessEnv,
  companyId?: string,
  agentId?: string,
): string {
  return path.join(resolveManagedClaudeHomeDir(env, companyId, agentId), ".claude");
}

async function ensureParentDir(target: string): Promise<void> {
  await fs.mkdir(path.dirname(target), { recursive: true });
}

async function ensureRegularFileTarget(target: string): Promise<void> {
  const existing = await fs.lstat(target).catch(() => null);
  if (!existing) return;
  if (existing.isSymbolicLink() || !existing.isFile()) {
    await fs.rm(target, { recursive: true, force: true });
  }
}

async function removeIfExists(target: string): Promise<void> {
  await fs.rm(target, { force: true }).catch(() => {});
}

function sanitizeSettingsObject(value: unknown): Record<string, unknown> | null {
  if (!isPlainRecord(value)) return null;
  const env = isPlainRecord(value.env)
    ? Object.fromEntries(
        Object.entries(value.env)
          .filter((entry): entry is [string, string | number | boolean] =>
            typeof entry[1] === "string" || typeof entry[1] === "number" || typeof entry[1] === "boolean")
          .map(([key, raw]) => [key, String(raw)]),
      )
    : {};
  if (Object.keys(env).length === 0) return null;
  return { env };
}

async function syncSanitizedSettingsFile(target: string, source: string): Promise<void> {
  if (!(await pathExists(source))) {
    await removeIfExists(target);
    return;
  }

  let raw: string;
  try {
    raw = await fs.readFile(source, "utf8");
  } catch {
    await removeIfExists(target);
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    await removeIfExists(target);
    return;
  }

  const sanitized = sanitizeSettingsObject(parsed);
  if (!sanitized) {
    await removeIfExists(target);
    return;
  }

  await ensureRegularFileTarget(target);
  const nextPayload = `${JSON.stringify(sanitized, null, 2)}\n`;
  const currentPayload = await fs.readFile(target, "utf8").catch(() => null);
  if (currentPayload === nextPayload) return;
  await ensureParentDir(target);
  await fs.writeFile(target, nextPayload, "utf8");
}

async function syncCopiedFile(target: string, source: string): Promise<void> {
  if (!(await pathExists(source))) {
    await removeIfExists(target);
    return;
  }
  await ensureRegularFileTarget(target);
  const nextPayload = await fs.readFile(source);
  const currentPayload = await fs.readFile(target).catch(() => null);
  if (currentPayload && Buffer.compare(currentPayload, nextPayload) === 0) return;
  await ensureParentDir(target);
  await fs.writeFile(target, nextPayload);
}

async function syncSharedAuthFiles(sourceConfigDir: string, targetConfigDir: string): Promise<void> {
  for (const name of COPIED_SHARED_FILES) {
    await syncCopiedFile(path.join(targetConfigDir, name), path.join(sourceConfigDir, name));
  }
}

async function resetManagedConfigArtifacts(targetConfigDir: string): Promise<void> {
  for (const name of PRUNED_CONFIG_ENTRIES) {
    await fs.rm(path.join(targetConfigDir, name), { recursive: true, force: true }).catch(() => {});
  }
  await fs.rm(path.join(targetConfigDir, "skills"), { recursive: true, force: true }).catch(() => {});
  await fs.mkdir(path.join(targetConfigDir, "skills"), { recursive: true });
}

export async function prepareManagedClaudeHome(
  env: NodeJS.ProcessEnv,
  onLog: AdapterExecutionContext["onLog"],
  companyId?: string,
  agentId?: string,
): Promise<{ homeDir: string; configDir: string }> {
  const targetHome = resolveManagedClaudeHomeDir(env, companyId, agentId);
  const targetConfigDir = resolveManagedClaudeConfigDir(env, companyId, agentId);
  const sourceConfigDir = resolveSharedClaudeConfigDir(env);
  if (path.resolve(sourceConfigDir) === path.resolve(targetConfigDir)) {
    return { homeDir: targetHome, configDir: targetConfigDir };
  }

  await fs.mkdir(targetConfigDir, { recursive: true });
  await resetManagedConfigArtifacts(targetConfigDir);
  await syncSharedAuthFiles(sourceConfigDir, targetConfigDir);
  await syncSanitizedSettingsFile(
    path.join(targetConfigDir, "settings.json"),
    path.join(sourceConfigDir, "settings.json"),
  );

  await onLog(
    "stdout",
    `[paperclip] Using ${isWorktreeMode(env) ? "worktree-isolated" : "Paperclip-managed"} Claude home "${targetHome}" (seeded from "${sourceConfigDir}").\n`,
  );

  return {
    homeDir: targetHome,
    configDir: targetConfigDir,
  };
}
