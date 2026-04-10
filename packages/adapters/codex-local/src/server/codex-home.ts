import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AdapterExecutionContext } from "@paperclipai/adapter-utils";

const TRUTHY_ENV_RE = /^(1|true|yes|on)$/i;
const COPIED_SHARED_FILES = ["config.json", "config.toml", "instructions.md"] as const;
const SYMLINKED_SHARED_FILES = ["auth.json"] as const;

function nonEmpty(value: string | undefined): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export async function pathExists(candidate: string): Promise<boolean> {
  return fs.access(candidate).then(() => true).catch(() => false);
}

export function resolveCodexHomeDir(env: NodeJS.ProcessEnv = process.env): string {
  const fromEnv = nonEmpty(env.CODEX_HOME);
  if (fromEnv) return path.resolve(fromEnv);
  return path.join(os.homedir(), ".codex");
}

function isWorktreeMode(env: NodeJS.ProcessEnv): boolean {
  return TRUTHY_ENV_RE.test(env.PAPERCLIP_IN_WORKTREE ?? "");
}

function resolveWorktreeCodexHomeDir(env: NodeJS.ProcessEnv): string | null {
  if (!isWorktreeMode(env)) return null;
  const paperclipHome = nonEmpty(env.PAPERCLIP_HOME);
  if (!paperclipHome) return null;
  const instanceId = nonEmpty(env.PAPERCLIP_INSTANCE_ID);
  if (instanceId) {
    return path.resolve(paperclipHome, "instances", instanceId, "codex-home");
  }
  return path.resolve(paperclipHome, "codex-home");
}

async function ensureParentDir(target: string): Promise<void> {
  await fs.mkdir(path.dirname(target), { recursive: true });
}

function isSymlinkPrivilegeError(error: unknown): boolean {
  return error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code !== undefined &&
    ["EPERM", "EACCES", "UNKNOWN"].includes(String((error as NodeJS.ErrnoException).code));
}

async function ensureCopiedFile(target: string, source: string): Promise<void> {
  const existing = await fs.lstat(target).catch(() => null);
  if (!existing) {
    await ensureParentDir(target);
    await fs.copyFile(source, target);
    return;
  }

  if (existing.isSymbolicLink()) {
    await fs.unlink(target);
  }
  await ensureParentDir(target);
  await fs.copyFile(source, target);
}

async function ensureSharedFileLinkOrCopy(
  target: string,
  source: string,
  onLog: AdapterExecutionContext["onLog"],
): Promise<"symlink" | "copy"> {
  const existing = await fs.lstat(target).catch(() => null);
  if (existing?.isSymbolicLink()) {
    const linkedPath = await fs.readlink(target).catch(() => null);
    if (linkedPath) {
      const resolvedLinkedPath = path.resolve(path.dirname(target), linkedPath);
      if (resolvedLinkedPath === source) return "symlink";
    }

    await fs.unlink(target);
  }

  if (!existing || existing.isSymbolicLink()) {
    try {
      await ensureParentDir(target);
      await fs.symlink(source, target);
      return "symlink";
    } catch (error) {
      if (!isSymlinkPrivilegeError(error)) throw error;
      await onLog(
        "stdout",
        `[paperclip] Symlink unavailable for "${path.basename(target)}"; copied file into worktree Codex home instead.\n`,
      );
    }
  }

  await ensureCopiedFile(target, source);
  return "copy";
}

export async function prepareWorktreeCodexHome(
  env: NodeJS.ProcessEnv,
  onLog: AdapterExecutionContext["onLog"],
): Promise<string | null> {
  const targetHome = resolveWorktreeCodexHomeDir(env);
  if (!targetHome) return null;

  const sourceHome = resolveCodexHomeDir(env);
  if (path.resolve(sourceHome) === path.resolve(targetHome)) return targetHome;

  await fs.mkdir(targetHome, { recursive: true });

  for (const name of SYMLINKED_SHARED_FILES) {
    const source = path.join(sourceHome, name);
    if (!(await pathExists(source))) continue;
    await ensureSharedFileLinkOrCopy(path.join(targetHome, name), source, onLog);
  }

  for (const name of COPIED_SHARED_FILES) {
    const source = path.join(sourceHome, name);
    if (!(await pathExists(source))) continue;
    await ensureCopiedFile(path.join(targetHome, name), source);
  }

  await onLog(
    "stdout",
    `[paperclip] Using worktree-isolated Codex home "${targetHome}" (seeded from "${sourceHome}").\n`,
  );
  return targetHome;
}
