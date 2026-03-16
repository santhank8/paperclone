import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { attachWorkspaceHealth } from "../services/project-workspace-health.ts";

const execFileAsync = promisify(execFile);

async function runGit(cwd: string, args: string[]) {
  await execFileAsync("git", args, { cwd });
}

async function createTempRepo() {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-project-health-"));
  await runGit(repoRoot, ["init"]);
  await runGit(repoRoot, ["config", "user.email", "paperclip@example.com"]);
  await runGit(repoRoot, ["config", "user.name", "Paperclip Test"]);
  await fs.writeFile(path.join(repoRoot, "README.md"), "hello\n", "utf8");
  await runGit(repoRoot, ["add", "README.md"]);
  await runGit(repoRoot, ["commit", "-m", "Initial commit"]);
  return repoRoot;
}

describe("attachWorkspaceHealth", () => {
  it("reports missing, non-git, and git-backed workspaces", async () => {
    const plainDir = await fs.mkdtemp(path.join(os.tmpdir(), "paperclip-project-plain-"));
    const repoDir = await createTempRepo();
    const missingDir = path.join(os.tmpdir(), "paperclip-project-missing-does-not-exist");

    const workspaces = await attachWorkspaceHealth([
      {
        id: "missing",
        companyId: "company-1",
        projectId: "project-1",
        name: "Missing",
        cwd: missingDir,
        repoUrl: null,
        repoRef: null,
        metadata: null,
        isPrimary: true,
        runtimeServices: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "plain",
        companyId: "company-1",
        projectId: "project-1",
        name: "Plain",
        cwd: plainDir,
        repoUrl: null,
        repoRef: null,
        metadata: null,
        isPrimary: false,
        runtimeServices: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "repo",
        companyId: "company-1",
        projectId: "project-1",
        name: "Repo",
        cwd: repoDir,
        repoUrl: null,
        repoRef: null,
        metadata: null,
        isPrimary: false,
        runtimeServices: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    expect(workspaces[0]?.health).toEqual({
      cwdConfigured: true,
      cwdExists: false,
      cwdIsDirectory: false,
      gitRepo: false,
    });
    expect(workspaces[1]?.health).toEqual({
      cwdConfigured: true,
      cwdExists: true,
      cwdIsDirectory: true,
      gitRepo: false,
    });
    expect(workspaces[2]?.health).toEqual({
      cwdConfigured: true,
      cwdExists: true,
      cwdIsDirectory: true,
      gitRepo: true,
    });
  });

  it("marks repo-only workspaces as uninspected locally", async () => {
    const [workspace] = await attachWorkspaceHealth([
      {
        id: "repo-only",
        companyId: "company-1",
        projectId: "project-1",
        name: "Repo Only",
        cwd: null,
        repoUrl: "https://github.com/paperclipai/paperclip",
        repoRef: null,
        metadata: null,
        isPrimary: true,
        runtimeServices: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    expect(workspace?.health).toEqual({
      cwdConfigured: false,
      cwdExists: false,
      cwdIsDirectory: false,
      gitRepo: null,
    });
  });
});
