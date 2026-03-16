import fs from "node:fs/promises";
import path from "node:path";
import type { ProjectWorkspace, ProjectWorkspaceHealth } from "@paperclipai/shared";

async function inspectCwd(cwd: string | null): Promise<ProjectWorkspaceHealth> {
  if (!cwd) {
    return {
      cwdConfigured: false,
      cwdExists: false,
      cwdIsDirectory: false,
      gitRepo: null,
    };
  }

  const stats = await fs.stat(cwd).catch(() => null);
  if (!stats) {
    return {
      cwdConfigured: true,
      cwdExists: false,
      cwdIsDirectory: false,
      gitRepo: false,
    };
  }

  if (!stats.isDirectory()) {
    return {
      cwdConfigured: true,
      cwdExists: true,
      cwdIsDirectory: false,
      gitRepo: false,
    };
  }

  const gitStats = await fs.stat(path.join(cwd, ".git")).catch(() => null);
  const gitRepo = gitStats ? gitStats.isDirectory() || gitStats.isFile() : false;

  return {
    cwdConfigured: true,
    cwdExists: true,
    cwdIsDirectory: true,
    gitRepo,
  };
}

export async function attachWorkspaceHealth<T extends ProjectWorkspace>(workspaces: T[]): Promise<T[]> {
  const healthByWorkspaceId = new Map(
    await Promise.all(
      workspaces.map(async (workspace) => [workspace.id, await inspectCwd(workspace.cwd ?? null)] as const),
    ),
  );

  return workspaces.map((workspace) => ({
    ...workspace,
    health: healthByWorkspaceId.get(workspace.id),
  }));
}

export function withPrimaryWorkspaceHealth<T extends { workspaces: ProjectWorkspace[]; primaryWorkspace: ProjectWorkspace | null }>(
  entity: T,
): T {
  const primaryWorkspace = entity.primaryWorkspace
    ? entity.workspaces.find((workspace) => workspace.id === entity.primaryWorkspace?.id) ?? entity.primaryWorkspace
    : null;

  return {
    ...entity,
    primaryWorkspace,
  };
}
